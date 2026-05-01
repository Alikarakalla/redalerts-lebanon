import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

function parseChannels(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export const config = {
  port: Number(process.env.PORT || 8787),
  telegramApiId: Number(process.env.TELEGRAM_API_ID || 0),
  telegramApiHash: process.env.TELEGRAM_API_HASH || '',
  telegramSession: process.env.TELEGRAM_SESSION || '',
  telegramSessionFile: path.resolve(process.cwd(), process.env.TELEGRAM_SESSION_FILE || '.telegram-session'),
  telegramStateFile: path.resolve(process.cwd(), process.env.TELEGRAM_STATE_FILE || 'server/data/telegram-state.json'),
  telegramEnabled: parseBoolean(process.env.TELEGRAM_ENABLED, true),
  telegramChannels: parseChannels(process.env.TELEGRAM_CHANNELS),
  telegramCheckIntervalMs: Number(process.env.TELEGRAM_CHECK_INTERVAL_MS || 15000),
  activeAlertTypes: parseChannels(
    process.env.ACTIVE_ALERT_TYPES || 'drone,warplane,airstrike,carAttack,artillery,missile,explosion,warning'
  ),
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-5.2',
  openAiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/u, ''),
  alertsDataFile: path.resolve(process.cwd(), process.env.ALERTS_DATA_FILE || 'server/data/alerts.json'),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAlertsTable: process.env.SUPABASE_ALERTS_TABLE || 'alerts',
};

export function hasTelegramConfig() {
  return Boolean(config.telegramApiId && config.telegramApiHash);
}

export function hasSupabaseConfig() {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

export function hasOpenAiConfig() {
  return Boolean(config.openAiApiKey);
}
