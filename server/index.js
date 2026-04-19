import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { isMappableAlert, processMessage } from './processMessage.js';
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

app.get('/api/alerts', async (req, res) => {
  try {
    const channelMessages = await getChannelMessagesSince(24, config.telegramChannels[0], 400);
    const processedAlerts = [];

    for (const message of channelMessages) {
      const processed = await processMessage(message.text, message.channel);
      processed.alert.timestamp = message.timestamp;

      if (!isMappableAlert(processed)) {
        continue;
      }

      if (isLikelyDuplicate(processed.alert, processedAlerts)) {
        continue;
      }

      processedAlerts.push(processed.alert);
    }

    const alerts = processedAlerts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

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
    const result = await saveAlert(processed.alert);
    return res.json(result);
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
      if (!isMappableAlert(processed)) {
        return;
      }
      const result = await saveAlert(processed.alert);
      if (result.saved) {
        console.log(`Saved alert from ${sourceChannel}: ${processed.alert.locationName}`);
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
