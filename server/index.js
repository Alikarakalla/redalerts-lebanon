import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getMappableAlerts, processMessage } from './processMessage.js';
import { getStorageMode, saveAlert } from './supabaseStore.js';
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

// ─── Telegram fetch ──────────────────────────────────────────────────────────
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
        if (isLikelyDuplicate(alert, processedAlerts)) continue;
        processedAlerts.push({
          ...alert,
          source: 'telegram',
          sourceLabel: message.channel?.toLowerCase().includes('redlinkleb') ? 'Telegram · RedLink' : 'Telegram',
        });
      }
    }
  }

  return processedAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ─── In-memory cache ────────────────────────────────────────────────────────
const CACHE_TTL_MS = 90_000; // refresh every 90 seconds
let alertsCache = { data: null, fetchedAt: 0, refreshing: false };

async function refreshAlertsCache() {
  if (alertsCache.refreshing) return;
  alertsCache.refreshing = true;
  try {
    const alerts = await getTelegramAlerts();
    alertsCache.data = alerts;
    alertsCache.fetchedAt = Date.now();
    console.log(`[cache] alerts refreshed — ${alerts.length} items`);
  } catch (error) {
    console.error('[cache] refresh failed:', error.message);
  } finally {
    alertsCache.refreshing = false;
  }
}

app.get('/api/alerts', async (req, res) => {
  // Serve from cache if fresh enough
  if (alertsCache.data && Date.now() - alertsCache.fetchedAt < CACHE_TTL_MS) {
    return res.json({ alerts: alertsCache.data, cached: true });
  }

  // If cache is stale but we have something, return it immediately and refresh in background
  if (alertsCache.data) {
    res.json({ alerts: alertsCache.data, cached: true });
    refreshAlertsCache();
    return;
  }

  // No cache yet — fetch synchronously (first cold start)
  try {
    await refreshAlertsCache();
    res.json({ alerts: alertsCache.data || [], cached: false });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
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
      } catch (error) {
        console.error('Listener pipeline failed:', error);
      }
    });

  } catch (error) {
    console.error('\n🔴 FATAL TELEGRAM ERROR:', error.message);
    console.error('The backend will stay running to serve the dashboard, but live alerts are DISABLE until you update your TELEGRAM_SESSION string!');
  }

  // Pre-warm cache immediately on startup so first visitor gets instant response
  console.log('[cache] Pre-warming alerts cache...');
  refreshAlertsCache();

  // Keep refreshing every 90 seconds in background
  setInterval(refreshAlertsCache, CACHE_TTL_MS);
}

bootstrap().catch((error) => {
  console.error('Server bootstrap failed:', error);
});
