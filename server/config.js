import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

function parseChannels(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 8787),
  telegramApiId: Number(process.env.TELEGRAM_API_ID || 0),
  telegramApiHash: process.env.TELEGRAM_API_HASH || '',
  telegramSession: process.env.TELEGRAM_SESSION || '',
  telegramSessionFile: path.resolve(process.cwd(), process.env.TELEGRAM_SESSION_FILE || '.telegram-session'),
  telegramChannels: parseChannels(process.env.TELEGRAM_CHANNELS),
  telegramCheckIntervalMs: Number(process.env.TELEGRAM_CHECK_INTERVAL_MS || 15000),
};

export function hasTelegramConfig() {
  return Boolean(config.telegramApiId && config.telegramApiHash);
}
