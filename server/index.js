import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getMappableAlerts, processMessage } from './processMessage.js';
import {
  getStorageMode,
  queryAlertHistory,
  saveAlert,
  serializeAlertsToCsv,
} from './supabaseStore.js';
import { isLikelyDuplicate } from './dedupe.js';
import { getChannelMessagesSince, getLatestChannelMessages, startTelegramListener } from './telegramListener.js';
import { trackVisitor, getStats } from './analytics.js';
import { resolveCoordinates } from './coordinates.js';

const app = express();
app.set('trust proxy', true);

app.use(cors());
app.use(express.json());

const ACTIVE_ALERT_TYPES = new Set(['drone', 'warplane']);
const TELEGRAM_CHANNELS_ENABLED = false;
const DEFAULT_ALERT_LB_API_URL = 'https://icy-limit-4d83.karakalla02.workers.dev/';
const PLACE_LABELS_URL = 'https://alert-lb.com/lebanon-places.geojson';
const NON_LOCATION_AREA_LABELS = new Set([
  '\u062a\u0631\u0643\u064a\u0632 \u0645\u0633\u064a\u0631',
  '\u0623\u0642\u0635\u0649 \u062f\u0631\u062c\u0627\u062a \u0627\u0644\u062d\u0630\u0631',
  '\u0645\u0642\u0627\u062a\u0644\u0627\u062a \u062d\u0631\u0628\u064a\u0629',
]);
let placeLabelIndexPromise = null;

function getAlertLbApiUrl() {
  const configuredUrl = String(process.env.ALERT_LB_API_URL || '').trim();
  if (
    !configuredUrl
    || configuredUrl.includes('YOUR-ACCOUNT')
    || configuredUrl.includes('alert-lb.com')
  ) {
    return DEFAULT_ALERT_LB_API_URL;
  }

  return configuredUrl;
}

function isActiveAlertType(alert) {
  return ACTIVE_ALERT_TYPES.has(alert?.type);
}

function filterActiveAlerts(alerts) {
  return alerts.filter(isActiveAlertType);
}

function normalizePlaceLabel(label) {
  return String(label || '')
    .replace(/_/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

async function getPlaceLabelIndex() {
  if (!placeLabelIndexPromise) {
    placeLabelIndexPromise = fetch(PLACE_LABELS_URL, {
      headers: {
        accept: 'application/geo+json, application/json, */*',
        'accept-language': 'ar,en-US;q=0.9,en;q=0.8',
        referer: 'https://alert-lb.com/ar/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Place labels returned ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        const index = new Map();
        const features = Array.isArray(payload.features) ? payload.features : [];

        for (const feature of features) {
          const [lng, lat] = feature.geometry?.coordinates || [];
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            continue;
          }

          for (const label of [feature.properties?.na, feature.properties?.n, feature.properties?.ne]) {
            const key = normalizePlaceLabel(label);
            if (key && !index.has(key)) {
              index.set(key, { lat, lng, resolved: true, source: 'alert-lb-places', label });
            }
          }
        }

        return index;
      })
      .catch((error) => {
        placeLabelIndexPromise = null;
        console.warn('[places] failed to load Alert LB place labels:', error.message);
        return new Map();
      });
  }

  return placeLabelIndexPromise;
}

async function resolvePlaceLabelCoordinates(label) {
  const index = await getPlaceLabelIndex();
  return index.get(normalizePlaceLabel(label)) || null;
}

function normalizeExternalType(type) {
  return type === 'plane' ? 'warplane' : type;
}

function getExternalLocationName(alert) {
  const titleLocation = typeof alert.title === 'string'
    ? alert.title.split(/[—-]/u).slice(1).join('—').trim()
    : '';

  return titleLocation || alert.areas?.filter(Boolean).join(', ') || 'Lebanon';
}

function buildExternalAlert(alert) {
  const type = normalizeExternalType(alert.type);

  return {
    id: alert.id,
    type,
    lat: alert.location?.latitude,
    lng: alert.location?.longitude,
    timestamp: alert.timestamp,
    locationName: getExternalLocationName(alert),
    description: alert.description,
    title: alert.title,
    areas: alert.areas,
    scope: alert.scope,
    region: alert.region,
    district: alert.district,
    governorate: alert.governorate,
    radius_km: alert.radius_km,
    radiusKm: alert.radius_km,
    verified: true,
    severity: type === 'warplane' ? 'high' : 'medium',
    source: 'alert-lb',
    sourceLabel: 'Alert LB',
    resolvedLocation: true,
    locationSource: 'alert-lb',
    reliabilityScore: 1,
    alertLevel: type === 'warplane' ? 'red' : 'orange',
  };
}

function isValidCoordinatePair(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

async function resolveExternalArea(area) {
  const label = String(area || '').replace(/\s+/gu, ' ').trim();
  if (!label || NON_LOCATION_AREA_LABELS.has(label)) {
    return null;
  }

  const coords = await resolvePlaceLabelCoordinates(label) || await resolveCoordinates(label);
  if (!coords?.resolved || !isValidCoordinatePair(coords.lat, coords.lng)) {
    return null;
  }

  return { label, coords };
}

async function expandExternalAlertAreas(alert) {
  const baseAlert = buildExternalAlert(alert);
  const areas = Array.isArray(alert.areas) ? alert.areas : [];

  if (alert.scope !== 'multi_village' || areas.length <= 1) {
    return [baseAlert];
  }

  const resolvedAreas = (await Promise.all(areas.map(resolveExternalArea))).filter(Boolean);
  if (resolvedAreas.length === 0) {
    return [baseAlert];
  }

  return resolvedAreas.map(({ label, coords }, index) => ({
    ...baseAlert,
    id: `${baseAlert.id}:area:${index}:${label}`,
    lat: coords.lat,
    lng: coords.lng,
    locationName: label,
    areaName: label,
    areas: [label],
    scope: 'village',
    originalScope: baseAlert.scope,
    parentAlertId: baseAlert.id,
    parentLocationName: baseAlert.locationName,
    radius_km: null,
    radiusKm: null,
    locationSource: coords.source || 'area-resolver',
  }));
}

app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    storage: getStorageMode(),
    time: new Date().toISOString(),
  });
});

app.post('/api/track', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const ua = req.get('user-agent') || 'unknown';
  trackVisitor(ip, ua);
  res.json({ tracked: true });
});

app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

function parseHistoryFilters(query) {
  return {
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    type: typeof query.type === 'string' ? query.type : undefined,
    severity: typeof query.severity === 'string' ? query.severity : undefined,
    location: typeof query.location === 'string' ? query.location : undefined,
    sourceChannel: typeof query.sourceChannel === 'string' ? query.sourceChannel : undefined,
    limit: query.limit,
    offset: query.offset,
  };
}

async function getTelegramAlerts() {
  const processedAlerts = [];
  const channels = config.telegramChannels.length > 0 ? config.telegramChannels : [undefined];

  for (const channel of channels) {
    const channelMessages = await getChannelMessagesSince(24, channel, 100);

    for (const message of channelMessages) {
      const processed = await processMessage(message.text, message.channel);
      const mappableAlerts = getMappableAlerts(processed).map((alert) => ({
        ...alert,
        timestamp: message.timestamp,
      }));

      for (const alert of mappableAlerts) {
        if (isLikelyDuplicate(alert, processedAlerts)) {
          continue;
        }

        processedAlerts.push({
          ...alert,
          source: 'telegram',
          sourceLabel: message.channel?.toLowerCase().includes('bintjbeilnews')
            ? 'Telegram - Bint Jbeil News'
            : 'Telegram',
        });
      }
    }
  }

  return processedAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function syncTelegramAlertsToStore() {
  const alerts = await getTelegramAlerts();
  let inserted = 0;

  for (const alert of alerts) {
    const result = await saveAlert(alert);
    if (result.saved) {
      inserted += 1;
    }
  }

  return { alerts, inserted };
}

async function fetchExternalAlerts() {
  const alertLbUrl = getAlertLbApiUrl();
  const response = await fetch(alertLbUrl, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'ar,en-US;q=0.9,en;q=0.8',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      referer: 'https://alert-lb.com/ar/',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(`Alert LB returned ${response.status}: ${body.slice(0, 180)}`);
    error.status = response.status;
    throw error;
  }

  const json = await response.json();
  const externalAlerts = json.alerts || [];

  const expandedAlerts = await Promise.all(
    externalAlerts
      .filter((a) => a.type === 'drone' || a.type === 'plane')
      .map(expandExternalAlertAreas)
  );

  return expandedAlerts
    .flat()
    .filter((a) => isValidCoordinatePair(a.lat, a.lng));
}

const CACHE_TTL_MS = 90_000;
const EXTERNAL_ALERTS_TTL_MS = 90_000;
const EXTERNAL_ALERTS_429_BACKOFF_MS = 5 * 60 * 1000;
let alertsCache = { data: null, fetchedAt: 0, refreshing: false };
let externalAlertsCache = { data: [], fetchedAt: 0, retryAfter: 0 };
const WARPLANE_TTL_MS = 20 * 60 * 1000;
const STREAM_POLL_INTERVAL_MS = 5_000;
const streamClients = new Set();
let streamPollTimer = null;
let streamSnapshot = new Map();

function serializeStreamPayload(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n${serializeStreamPayload(payload)}`);
}

function getAlertsSnapshotMap(alerts) {
  return new Map(
    filterActiveAlerts(filterExpiredWarplanes(alerts || [])).map((alert) => [alert.id, alert])
  );
}

function alertsDiffer(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function broadcastStreamEvent(event, payload) {
  for (const client of streamClients) {
    try {
      writeSseEvent(client, event, payload);
    } catch (error) {
      console.warn('[stream] failed to write to client:', error.message);
    }
  }
}

function applyStreamDiff(nextAlerts) {
  const nextSnapshot = getAlertsSnapshotMap(nextAlerts);

  for (const [id, alert] of nextSnapshot) {
    if (!streamSnapshot.has(id)) {
      broadcastStreamEvent('INSERT', { alert });
      continue;
    }

    const previous = streamSnapshot.get(id);
    if (alertsDiffer(previous, alert)) {
      broadcastStreamEvent('UPDATE', { alert });
    }
  }

  for (const [id] of streamSnapshot) {
    if (!nextSnapshot.has(id)) {
      broadcastStreamEvent('DELETE', { id });
    }
  }

  streamSnapshot = nextSnapshot;
}

async function pollStreamSnapshot() {
  try {
    await refreshAlertsCache();
    applyStreamDiff(alertsCache.data || []);
  } catch (error) {
    console.error('[stream] poll failed:', error.message);
    broadcastStreamEvent('ERROR', { message: error.message });
  }
}

function ensureStreamPolling() {
  if (streamPollTimer || streamClients.size === 0) {
    return;
  }

  streamPollTimer = setInterval(() => {
    pollStreamSnapshot();
  }, STREAM_POLL_INTERVAL_MS);
}

function stopStreamPollingIfIdle() {
  if (streamClients.size > 0 || !streamPollTimer) {
    return;
  }

  clearInterval(streamPollTimer);
  streamPollTimer = null;
}

function isExpiredWarplaneAlert(alert, now = Date.now()) {
  if (alert?.type !== 'warplane') {
    return false;
  }

  const eventTime = new Date(alert.timestamp).getTime();
  if (!Number.isFinite(eventTime)) {
    return false;
  }

  return now - eventTime > WARPLANE_TTL_MS;
}

function filterExpiredWarplanes(alerts, now = Date.now()) {
  return alerts.filter((alert) => !isExpiredWarplaneAlert(alert, now));
}

async function refreshAlertsCache() {
  const now = Date.now();

  if (alertsCache.data && now - alertsCache.fetchedAt < CACHE_TTL_MS) {
    return;
  }

  if (alertsCache.refreshing) {
    return;
  }

  alertsCache.refreshing = true;

  try {
    let syncResult = { alerts: [], inserted: 0 };
    if (TELEGRAM_CHANNELS_ENABLED) {
      try {
        syncResult = await syncTelegramAlertsToStore();
      } catch (error) {
        console.warn('[cache] telegram sync failed, using stored alerts:', error.message);
      }
    }

    let externalAlerts = filterActiveAlerts(filterExpiredWarplanes(externalAlertsCache.data || [], now));
    const externalCacheFresh = externalAlertsCache.fetchedAt > 0
      && now - externalAlertsCache.fetchedAt < EXTERNAL_ALERTS_TTL_MS;
    const inBackoffWindow = externalAlertsCache.retryAfter > now;

    if (externalCacheFresh) {
      // Avoid refetching upstream data while the local cache is still fresh.
      externalAlerts = filterActiveAlerts(filterExpiredWarplanes(externalAlertsCache.data || [], now));
    } else if (inBackoffWindow) {
      console.warn(
        `[external] backing off until ${new Date(externalAlertsCache.retryAfter).toISOString()} after upstream rate limiting`
      );
    } else {
      try {
        externalAlerts = filterActiveAlerts(filterExpiredWarplanes(await fetchExternalAlerts(), now));
        externalAlertsCache = {
          data: externalAlerts,
          fetchedAt: now,
          retryAfter: 0,
        };
      } catch (error) {
        console.error(`[external] ${error.message}`);
        externalAlerts = filterActiveAlerts(filterExpiredWarplanes(externalAlertsCache.data || [], now));
        externalAlertsCache = {
          data: externalAlerts,
          fetchedAt: externalAlertsCache.fetchedAt,
          retryAfter: error.status === 429 ? now + EXTERNAL_ALERTS_429_BACKOFF_MS : 0,
        };
      }
    }
    
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { alerts: storedAlerts } = await queryAlertHistory({
      from: windowStart,
      limit: 500,
      offset: 0,
    });

    // Merge stored alerts with real-time external alerts
    // We prioritize external alerts for drones and planes
    const internalAlerts = storedAlerts.length > 0 ? storedAlerts : syncResult.alerts;
    
    const filteredInternal = filterActiveAlerts(filterExpiredWarplanes(internalAlerts, now))
      .filter((a) => a.source !== 'telegram')
      .filter((a) => externalAlerts.length === 0 || !ACTIVE_ALERT_TYPES.has(a.type));

    const alerts = filterActiveAlerts(filterExpiredWarplanes([...externalAlerts, ...filteredInternal], now)).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    alertsCache.data = alerts;
    alertsCache.fetchedAt = Date.now();
    console.log(
      `[cache] alerts refreshed - ${alerts.length} items (${storedAlerts.length} stored, ${syncResult.alerts.length} synced, ${syncResult.inserted} inserted)`
    );
  } catch (error) {
    console.error('[cache] refresh failed:', error.message);
  } finally {
    alertsCache.refreshing = false;
  }
}

app.get('/api/alerts', async (_req, res) => {
  if (alertsCache.data && Date.now() - alertsCache.fetchedAt < CACHE_TTL_MS) {
    return res.json({
      alerts: filterActiveAlerts(filterExpiredWarplanes(alertsCache.data)),
      cached: true,
      storage: getStorageMode(),
    });
  }

  if (alertsCache.data) {
    res.json({
      alerts: filterActiveAlerts(filterExpiredWarplanes(alertsCache.data)),
      cached: true,
      storage: getStorageMode(),
    });
    refreshAlertsCache();
    return;
  }

  try {
    await refreshAlertsCache();
    res.json({ alerts: filterActiveAlerts(alertsCache.data || []), cached: false, storage: getStorageMode() });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

app.get('/api/alerts/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(': connected\n\n');
  streamClients.add(res);

  try {
    if (!alertsCache.data) {
      await refreshAlertsCache();
    }

    const initialAlerts = filterActiveAlerts(filterExpiredWarplanes(alertsCache.data || []));
    if (streamSnapshot.size === 0) {
      streamSnapshot = getAlertsSnapshotMap(initialAlerts);
    }

    writeSseEvent(res, 'READY', {
      alerts: initialAlerts,
      storage: getStorageMode(),
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[stream] initial sync failed:', error.message);
    writeSseEvent(res, 'ERROR', { message: error.message });
  }

  ensureStreamPolling();

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    streamClients.delete(res);
    stopStreamPollingIfIdle();
  });
});

app.get('/api/alert-lb', async (_req, res) => {
  try {
    const alerts = await fetchExternalAlerts();
    externalAlertsCache = {
      data: filterActiveAlerts(filterExpiredWarplanes(alerts)),
      fetchedAt: Date.now(),
      retryAfter: 0,
    };
    res.json({ alerts, source: 'alert-lb' });
  } catch (error) {
    console.error('Failed to fetch Alert LB alerts:', error.message);
    externalAlertsCache = {
      data: filterActiveAlerts(filterExpiredWarplanes(externalAlertsCache.data || [])),
      fetchedAt: externalAlertsCache.fetchedAt,
      retryAfter: error.status === 429 ? Date.now() + EXTERNAL_ALERTS_429_BACKOFF_MS : 0,
    };
    res.json({ alerts: externalAlertsCache.data, source: 'alert-lb', stale: true });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const filters = parseHistoryFilters(req.query);
    const result = await queryAlertHistory(filters);

    res.json({
      ...result,
      storage: getStorageMode(),
      filters,
    });
  } catch (error) {
    console.error('Failed to fetch alert history:', error);
    res.status(500).json({ error: 'Failed to fetch alert history' });
  }
});

app.get('/api/history/export', async (req, res) => {
  try {
    const format = typeof req.query.format === 'string' ? req.query.format.toLowerCase() : 'json';
    const filters = parseHistoryFilters(req.query);
    const result = await queryAlertHistory({
      ...filters,
      limit: 5000,
      offset: 0,
    });

    if (format === 'csv') {
      const csv = serializeAlertsToCsv(result.alerts);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="alerts-export.csv"');
      return res.send(csv);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          total: result.total,
          filters,
          alerts: result.alerts,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Failed to export alert history:', error);
    res.status(500).json({ error: 'Failed to export alert history' });
  }
});

app.get('/api/telegram/latest', async (req, res) => {
  try {
    if (!TELEGRAM_CHANNELS_ENABLED) {
      return res.json({ messages: [], disabled: true });
    }

    const limit = Math.min(Number(req.query.limit || 10), 50);
    const channel = typeof req.query.channel === 'string' ? req.query.channel : undefined;
    const messages = await getLatestChannelMessages(limit, channel);
    res.json({ messages });
  } catch (error) {
    console.error('Failed to fetch Telegram messages:', error);
    res.status(500).json({ error: 'Failed to fetch Telegram messages' });
  }
});

app.post('/api/process-message', async (req, res) => {
  try {
    const { text, sourceChannel = 'manual' } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const processed = await processMessage(text, sourceChannel);
    const alerts = filterActiveAlerts(getMappableAlerts(processed));
    const results = [];

    for (const alert of alerts) {
      results.push(await saveAlert(alert));
    }

    return res.json({ saved: results.some((result) => result.saved), results });
  } catch (error) {
    console.error('Failed to process message:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
});

async function bootstrap() {
  app.listen(config.port, () => {
    console.log(`API server listening on http://localhost:${config.port}`);
  });

  if (TELEGRAM_CHANNELS_ENABLED) {
    try {
      await startTelegramListener(async ({ text, sourceChannel }) => {
        try {
          const processed = await processMessage(text, sourceChannel);
          const alerts = filterActiveAlerts(getMappableAlerts(processed));

          if (alerts.length === 0) {
            return;
          }

          for (const alert of alerts) {
            const result = await saveAlert(alert);
            if (result.saved) {
              console.log(`Saved alert from ${sourceChannel}: ${alert.locationName}`);
            }
          }

          alertsCache.fetchedAt = 0;
        } catch (error) {
          console.error('Listener pipeline failed:', error);
        }
      });
    } catch (error) {
      console.error('\nFATAL TELEGRAM ERROR:', error.message);
      console.error(
        'The backend will stay running to serve the dashboard, but live alerts are disabled until you update your TELEGRAM_SESSION string!'
      );
    }
  } else {
    console.log('[telegram] channel listener disabled');
  }

  console.log('[cache] Pre-warming alerts cache...');
  refreshAlertsCache();

  setInterval(refreshAlertsCache, CACHE_TTL_MS);
}

bootstrap().catch((error) => {
  console.error('Server bootstrap failed:', error);
});
