import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { sampleAlerts } from './sampleData.js';
import { config, hasSupabaseConfig } from './config.js';
import { isLikelyDuplicate } from './dedupe.js';

const FILE_STORE_LIMIT = 5000;
let supabaseClient = null;
let fileStore = loadFileStore();

function loadFileStore() {
  try {
    if (!fs.existsSync(config.alertsDataFile)) {
      return [...sampleAlerts];
    }

    const payload = JSON.parse(fs.readFileSync(config.alertsDataFile, 'utf8'));
    return Array.isArray(payload) ? payload : [...sampleAlerts];
  } catch {
    return [...sampleAlerts];
  }
}

function saveFileStore() {
  try {
    fs.mkdirSync(path.dirname(config.alertsDataFile), { recursive: true });
    fs.writeFileSync(config.alertsDataFile, JSON.stringify(fileStore, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to persist alerts file:', error.message);
  }
}

function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

function toDatabaseRecord(alert) {
  return {
    id: alert.id,
    type: alert.type,
    lat: alert.lat,
    lng: alert.lng,
    timestamp: alert.timestamp,
    location_name: alert.locationName,
    description: alert.description,
    verified: Boolean(alert.verified),
    severity: alert.severity,
    source_channel: alert.sourceChannel ?? null,
    source_label: alert.sourceLabel ?? null,
    resolved_location: Boolean(alert.resolvedLocation),
    location_source: alert.locationSource ?? null,
    reliability_score: typeof alert.reliabilityScore === 'number' ? alert.reliabilityScore : null,
    alert_level: alert.alertLevel ?? null,
    source_fingerprint: alert.sourceFingerprint ?? null,
  };
}

function fromDatabaseRecord(record) {
  return {
    id: record.id,
    type: record.type,
    lat: record.lat,
    lng: record.lng,
    timestamp: record.timestamp,
    locationName: record.location_name,
    description: record.description,
    verified: Boolean(record.verified),
    severity: record.severity,
    sourceChannel: record.source_channel,
    sourceLabel: record.source_label,
    resolvedLocation: Boolean(record.resolved_location),
    locationSource: record.location_source,
    reliabilityScore: record.reliability_score,
    alertLevel: record.alert_level,
    sourceFingerprint: record.source_fingerprint,
    createdAt: record.created_at ?? null,
  };
}

function normalizeLimit(limit, fallback = 50, max = 1000) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function normalizeOffset(offset) {
  const parsed = Number(offset);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function applyAlertFilters(alerts, filters = {}) {
  const location = normalizeText(filters.location).toLowerCase();
  const type = normalizeText(filters.type).toLowerCase();
  const severity = normalizeText(filters.severity).toLowerCase();
  const sourceChannel = normalizeText(filters.sourceChannel).toLowerCase();
  const from = normalizeDate(filters.from);
  const to = normalizeDate(filters.to);

  return alerts.filter((alert) => {
    const timestamp = new Date(alert.timestamp).getTime();

    if (from && timestamp < new Date(from).getTime()) {
      return false;
    }

    if (to && timestamp > new Date(to).getTime()) {
      return false;
    }

    if (type && String(alert.type || '').toLowerCase() !== type) {
      return false;
    }

    if (severity && String(alert.severity || '').toLowerCase() !== severity) {
      return false;
    }

    if (sourceChannel && String(alert.sourceChannel || '').toLowerCase() !== sourceChannel) {
      return false;
    }

    if (location) {
      const haystack = `${alert.locationName || ''} ${alert.description || ''}`.toLowerCase();
      if (!haystack.includes(location)) {
        return false;
      }
    }

    return true;
  });
}

function sortAlertsByTimestamp(alerts) {
  return [...alerts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getLatestAlertsFromFile(limit = 50) {
  return sortAlertsByTimestamp(fileStore).slice(0, normalizeLimit(limit));
}

async function saveAlertToFile(alert) {
  const existingAlerts = await getLatestAlertsFromFile(200);

  if (isLikelyDuplicate(alert, existingAlerts)) {
    return { saved: false, reason: 'duplicate' };
  }

  fileStore.unshift(alert);
  fileStore = sortAlertsByTimestamp(fileStore).slice(0, FILE_STORE_LIMIT);
  saveFileStore();
  return { saved: true, alert };
}

async function queryAlertsFromFile(filters = {}) {
  const limit = normalizeLimit(filters.limit, 100, 5000);
  const offset = normalizeOffset(filters.offset);
  const filtered = applyAlertFilters(sortAlertsByTimestamp(fileStore), filters);

  return {
    alerts: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
  };
}

async function getLatestAlertsFromSupabase(limit = 50) {
  const client = getSupabaseClient();
  const rowLimit = normalizeLimit(limit);
  const { data, error } = await client
    .from(config.supabaseAlertsTable)
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(rowLimit);

  if (error) {
    throw error;
  }

  return (data || []).map(fromDatabaseRecord);
}

async function saveAlertToSupabase(alert) {
  const existingAlerts = await getLatestAlertsFromSupabase(200);

  if (isLikelyDuplicate(alert, existingAlerts)) {
    return { saved: false, reason: 'duplicate' };
  }

  const client = getSupabaseClient();
  const record = toDatabaseRecord(alert);
  const { data, error } = await client
    .from(config.supabaseAlertsTable)
    .insert(record)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return { saved: true, alert: fromDatabaseRecord(data) };
}

async function queryAlertsFromSupabase(filters = {}) {
  const client = getSupabaseClient();
  const limit = normalizeLimit(filters.limit, 100, 5000);
  const offset = normalizeOffset(filters.offset);
  const from = normalizeDate(filters.from);
  const to = normalizeDate(filters.to);
  const type = normalizeText(filters.type);
  const severity = normalizeText(filters.severity);
  const location = normalizeText(filters.location);
  const sourceChannel = normalizeText(filters.sourceChannel);

  let query = client
    .from(config.supabaseAlertsTable)
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (from) {
    query = query.gte('timestamp', from);
  }

  if (to) {
    query = query.lte('timestamp', to);
  }

  if (type) {
    query = query.eq('type', type);
  }

  if (severity) {
    query = query.eq('severity', severity);
  }

  if (sourceChannel) {
    query = query.eq('source_channel', sourceChannel);
  }

  if (location) {
    query = query.or(`location_name.ilike.%${location}%,description.ilike.%${location}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  return {
    alerts: (data || []).map(fromDatabaseRecord),
    total: count ?? 0,
    limit,
    offset,
  };
}

export async function getLatestAlerts(limit = 50) {
  if (hasSupabaseConfig()) {
    return getLatestAlertsFromSupabase(limit);
  }

  return getLatestAlertsFromFile(limit);
}

export async function saveAlert(alert) {
  if (hasSupabaseConfig()) {
    return saveAlertToSupabase(alert);
  }

  return saveAlertToFile(alert);
}

export async function queryAlertHistory(filters = {}) {
  if (hasSupabaseConfig()) {
    return queryAlertsFromSupabase(filters);
  }

  return queryAlertsFromFile(filters);
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (!/[",\r\n]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function serializeAlertsToCsv(alerts) {
  const columns = [
    'id',
    'timestamp',
    'type',
    'severity',
    'alertLevel',
    'locationName',
    'lat',
    'lng',
    'sourceChannel',
    'sourceLabel',
    'verified',
    'reliabilityScore',
    'resolvedLocation',
    'locationSource',
    'description',
  ];

  const lines = [
    columns.join(','),
    ...alerts.map((alert) =>
      columns
        .map((column) => escapeCsvValue(alert[column]))
        .join(',')
    ),
  ];

  return lines.join('\n');
}

export function getStorageMode() {
  return hasSupabaseConfig() ? 'supabase' : 'file';
}
