import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getMappableAlerts, processMessage } from './processMessage.js';
import { getStorageMode, saveAlert } from './supabaseStore.js';
import { isLikelyDuplicate } from './dedupe.js';
import { getChannelMessagesSince, getLatestChannelMessages, startTelegramListener } from './telegramListener.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    storage: getStorageMode(),
    time: new Date().toISOString(),
  });
});

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
          sourceLabel: message.channel?.toLowerCase().includes('redlinkleb') ? 'Telegram · RedLink' : 'Telegram',
        });
      }
    }
  }

  return processedAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await getTelegramAlerts();
    res.json({ alerts });
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
}

bootstrap().catch((error) => {
  console.error('Server bootstrap failed:', error);
  process.exit(1);
});
