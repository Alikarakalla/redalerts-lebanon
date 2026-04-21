import fs from 'node:fs';
import path from 'node:path';
import input from 'input';
import { StringSession } from 'telegram/sessions/index.js';
import { TelegramClient } from 'telegram';
import { NewMessage } from 'telegram/events/NewMessage.js';
import { config, hasTelegramConfig } from './config.js';

let client = null;
const latestRawMessages = [];

function trackRawMessage(message) {
  latestRawMessages.unshift(message);
  latestRawMessages.splice(10);
}

function toIsoTimestamp(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    return new Date(value * 1000).toISOString();
  }

  return new Date().toISOString();
}

function normalizeTelegramMessage(message, fallbackChannel) {
  const text = message?.message?.trim();

  if (!text) {
    return null;
  }

  return {
    id: String(message.id),
    text,
    timestamp: toIsoTimestamp(message.date),
    views: typeof message.views === 'number' ? message.views : null,
    channel: fallbackChannel,
  };
}

function loadSavedSession() {
  if (config.telegramSession) {
    return config.telegramSession.trim();
  }

  if (!fs.existsSync(config.telegramSessionFile)) {
    return '';
  }

  return fs.readFileSync(config.telegramSessionFile, 'utf8').trim();
}

function saveSession(sessionValue) {
  if (!sessionValue) {
    return;
  }

  const directory = path.dirname(config.telegramSessionFile);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(config.telegramSessionFile, sessionValue, 'utf8');
  console.log(`Telegram session saved to ${config.telegramSessionFile}`);
}

async function ensureTelegramClient() {
  if (client || !hasTelegramConfig()) {
    return client;
  }

  client = new TelegramClient(
    new StringSession(loadSavedSession()),
    config.telegramApiId,
    config.telegramApiHash,
    {
      connectionRetries: 5,
    }
  );

  await client.start({
    phoneNumber: async () => input.text('Telegram phone number: '),
    password: async () => input.text('Telegram 2FA password (if any): '),
    phoneCode: async () => input.text('Telegram login code: '),
    onError: (error) => console.error('Telegram auth error:', error),
  });

  const savedSession = client.session.save();
  saveSession(savedSession);
  console.log('Telegram session:', savedSession);

  return client;
}

export async function getLatestChannelMessages(limit = 10, channel) {
  if (!hasTelegramConfig()) {
    return latestRawMessages.slice(0, limit);
  }

  const telegramClient = await ensureTelegramClient();
  const targetChannels = channel ? [channel] : config.telegramChannels;

  if (!targetChannels || targetChannels.length === 0) {
    return latestRawMessages.slice(0, limit);
  }

  const batches = await Promise.all(
    targetChannels.map((targetChannel) =>
      telegramClient.getMessages(targetChannel, { limit }).then((messages) =>
        messages.map((message) => normalizeTelegramMessage(message, targetChannel)).filter(Boolean)
      )
    )
  );

  return batches
    .flat()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function getChannelMessagesSince(hours = 24, channel = config.telegramChannels[0], maxMessages = 300) {
  if (!hasTelegramConfig()) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return latestRawMessages
      .filter((message) => new Date(message.timestamp).getTime() >= cutoff)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  const telegramClient = await ensureTelegramClient();
  const targetChannel = channel || config.telegramChannels[0];

  if (!targetChannel) {
    return [];
  }

  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const messages = await telegramClient.getMessages(targetChannel, { limit: maxMessages });

  return messages
    .map((message) => normalizeTelegramMessage(message, targetChannel))
    .filter(Boolean)
    .filter((message) => new Date(message.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function startTelegramListener(onMessage) {
  if (!hasTelegramConfig()) {
    console.log('Telegram listener disabled: TELEGRAM_API_ID or TELEGRAM_API_HASH missing.');
    return { enabled: false };
  }

  const telegramClient = await ensureTelegramClient();
  const trackedChannels = config.telegramChannels;

  telegramClient.addEventHandler(
    async (event) => {
      const messageText = event.message?.message?.trim();
      const peer = event.message?.peerId;
      const channelId = peer?.channelId?.toString();
      const entity = channelId ? await telegramClient.getEntity(peer).catch(() => null) : null;
      const channelHandle = entity?.username ? `@${entity.username}` : channelId ? `channel:${channelId}` : 'unknown';

      if (!messageText) {
        return;
      }

      if (trackedChannels.length > 0 && !trackedChannels.some((item) => item.toLowerCase() === channelHandle.toLowerCase())) {
        return;
      }

      trackRawMessage({
        id: String(event.message.id),
        text: messageText,
        timestamp: toIsoTimestamp(event.message.date),
        views: typeof event.message.views === 'number' ? event.message.views : null,
        channel: channelHandle,
      });

      await onMessage({
        text: messageText,
        sourceChannel: channelHandle,
      });
    },
    new NewMessage({})
  );

  console.log(`Telegram listener attached for ${trackedChannels.length || 'all'} channels.`);
  return { enabled: true };
}
