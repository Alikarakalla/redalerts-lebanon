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

const app = express();
app.set('trust proxy', true);

app.use(cors());
app.use(express.json());

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
    const channelMessages = await getChannelMessagesSince(24, channel, 400);

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
          sourceLabel: message.channel?.toLowerCase().includes('redlinkleb')
            ? 'Telegram - RedLink'
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

const CACHE_TTL_MS = 90_000;
let alertsCache = { data: null, fetchedAt: 0, refreshing: false };

async function refreshAlertsCache() {
  if (alertsCache.refreshing) {
    return;
  }

  alertsCache.refreshing = true;

  try {
    const syncResult = await syncTelegramAlertsToStore();
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { alerts: storedAlerts } = await queryAlertHistory({
      from: windowStart,
      limit: 500,
      offset: 0,
    });
    const alerts = storedAlerts.length > 0 ? storedAlerts : syncResult.alerts;

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
    return res.json({ alerts: alertsCache.data, cached: true, storage: getStorageMode() });
  }

  if (alertsCache.data) {
    res.json({ alerts: alertsCache.data, cached: true, storage: getStorageMode() });
    refreshAlertsCache();
    return;
  }

  try {
    await refreshAlertsCache();
    res.json({ alerts: alertsCache.data || [], cached: false, storage: getStorageMode() });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
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
    const alerts = getMappableAlerts(processed);
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

  try {
    await startTelegramListener(async ({ text, sourceChannel }) => {
      try {
        const processed = await processMessage(text, sourceChannel);
        const alerts = getMappableAlerts(processed);

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

  console.log('[cache] Pre-warming alerts cache...');
  refreshAlertsCache();

  setInterval(refreshAlertsCache, CACHE_TTL_MS);
}

bootstrap().catch((error) => {
  console.error('Server bootstrap failed:', error);
});
