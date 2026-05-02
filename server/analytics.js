import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { config, hasSupabaseConfig } from './config.js';

const ANALYTICS_FILE = path.resolve(process.cwd(), 'server', 'data', 'analytics.json');
const ANALYTICS_ROW_ID = 'global';
const SERVER_START_TIME = new Date().toISOString();

let analyticsData = createEmptyAnalytics();
let supabaseClient = null;
let analyticsReadyPromise = null;

function createEmptyAnalytics() {
  return {
    totalViews: 0,
    distinctVisitors: 0,
    dailyStats: {},
    recentVisitors: [],
    deviceStats: {},
    countryStats: {},
    browserStats: {},
    hourlyStats: {},
  };
}

function normalizeAnalytics(payload) {
  const base = createEmptyAnalytics();
  const data = payload && typeof payload === 'object' ? payload : {};

  return {
    totalViews: Number.isFinite(Number(data.totalViews)) ? Number(data.totalViews) : base.totalViews,
    distinctVisitors: Number.isFinite(Number(data.distinctVisitors)) ? Number(data.distinctVisitors) : base.distinctVisitors,
    dailyStats: data.dailyStats && typeof data.dailyStats === 'object' ? data.dailyStats : base.dailyStats,
    recentVisitors: Array.isArray(data.recentVisitors) ? data.recentVisitors : base.recentVisitors,
    deviceStats: data.deviceStats && typeof data.deviceStats === 'object' ? data.deviceStats : base.deviceStats,
    countryStats: data.countryStats && typeof data.countryStats === 'object' ? data.countryStats : base.countryStats,
    browserStats: data.browserStats && typeof data.browserStats === 'object' ? data.browserStats : base.browserStats,
    hourlyStats: data.hourlyStats && typeof data.hourlyStats === 'object' ? data.hourlyStats : base.hourlyStats,
  };
}

function loadAnalyticsFromFile() {
  try {
    if (!fs.existsSync(ANALYTICS_FILE)) {
      return createEmptyAnalytics();
    }

    return normalizeAnalytics(JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8')));
  } catch {
    return createEmptyAnalytics();
  }
}

function saveAnalyticsToFile() {
  try {
    fs.mkdirSync(path.dirname(ANALYTICS_FILE), { recursive: true });
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analyticsData, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save analytics', error);
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

async function loadAnalyticsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from(config.supabaseAnalyticsTable)
    .select('payload')
    .eq('id', ANALYTICS_ROW_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.payload ? normalizeAnalytics(data.payload) : null;
}

async function saveAnalyticsToSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  const { error } = await client
    .from(config.supabaseAnalyticsTable)
    .upsert({
      id: ANALYTICS_ROW_ID,
      payload: analyticsData,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

async function ensureAnalyticsReady() {
  if (analyticsReadyPromise) {
    return analyticsReadyPromise;
  }

  analyticsReadyPromise = (async () => {
    const fileAnalytics = loadAnalyticsFromFile();

    if (!hasSupabaseConfig()) {
      analyticsData = fileAnalytics;
      return analyticsData;
    }

    try {
      const remoteAnalytics = await loadAnalyticsFromSupabase();
      if (remoteAnalytics) {
        analyticsData = remoteAnalytics;
        return analyticsData;
      }

      analyticsData = fileAnalytics;
      await saveAnalyticsToSupabase();
      return analyticsData;
    } catch (error) {
      console.error('Failed to initialize analytics from Supabase:', error.message);
      analyticsData = fileAnalytics;
      return analyticsData;
    }
  })();

  return analyticsReadyPromise;
}

async function persistAnalytics() {
  if (hasSupabaseConfig()) {
    try {
      await saveAnalyticsToSupabase();
      return;
    } catch (error) {
      console.error('Failed to persist analytics to Supabase:', error.message);
    }
  }

  saveAnalyticsToFile();
}

function getTodayKey() {
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getCurrentHour() {
  return `${String(new Date().getUTCHours()).padStart(2, '0')}:00`;
}

function parseUserAgent(ua) {
  const u = ua.toLowerCase();

  let device = 'Desktop';
  if (u.includes('ipad')) device = 'iPad';
  else if (u.includes('iphone') || u.includes('ipod')) device = 'iPhone';
  else if (u.includes('android') && u.includes('mobile')) device = 'Android Phone';
  else if (u.includes('android')) device = 'Android Tablet';
  else if (u.includes('mobile')) device = 'Mobile';

  let os = 'Unknown';
  if (u.includes('windows nt 10') || u.includes('windows 10')) os = 'Windows 10/11';
  else if (u.includes('windows nt 6.3') || u.includes('windows 8.1')) os = 'Windows 8.1';
  else if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os x') || u.includes('macos')) os = 'macOS';
  else if (u.includes('iphone') || u.includes('ipad') || u.includes('ipod')) os = 'iOS';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('linux')) os = 'Linux';

  let browser = 'Unknown';
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('opr/') || u.includes('opera')) browser = 'Opera';
  else if (u.includes('chrome') && !u.includes('chromium')) browser = 'Chrome';
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari';
  else if (u.includes('firefox')) browser = 'Firefox';
  else if (u.includes('samsung')) browser = 'Samsung Browser';

  return { device, os, browser };
}

export async function trackVisitor(ip, userAgent) {
  await ensureAnalyticsReady();

  const today = getTodayKey();
  const hour = getCurrentHour();

  if (!analyticsData.dailyStats[today]) {
    analyticsData.dailyStats[today] = { views: 0, uniqueIps: [] };
  }

  const todayStats = analyticsData.dailyStats[today];
  todayStats.views += 1;
  analyticsData.totalViews += 1;

  const hourKey = `${today}T${hour}`;
  if (!analyticsData.hourlyStats[hourKey]) {
    analyticsData.hourlyStats[hourKey] = 0;
  }
  analyticsData.hourlyStats[hourKey] += 1;

  const ipHash = crypto.createHash('sha256').update(ip + userAgent).digest('hex');
  if (!todayStats.uniqueIps.includes(ipHash)) {
    todayStats.uniqueIps.push(ipHash);
    analyticsData.distinctVisitors += 1;
  }

  const { device, os, browser } = parseUserAgent(userAgent);
  analyticsData.deviceStats[device] = (analyticsData.deviceStats[device] || 0) + 1;
  analyticsData.browserStats[browser] = (analyticsData.browserStats[browser] || 0) + 1;

  const existingIndex = analyticsData.recentVisitors.findIndex((visitor) => visitor.ip === ip);
  if (existingIndex !== -1) {
    analyticsData.recentVisitors.splice(existingIndex, 1);
  }

  const entry = {
    ip,
    device,
    os,
    browser,
    timestamp: new Date().toISOString(),
    location: null,
    flag: null,
  };
  analyticsData.recentVisitors.unshift(entry);
  analyticsData.recentVisitors = analyticsData.recentVisitors.slice(0, 100);

  await persistAnalytics();

  if (ip && ip !== 'unknown' && ip !== '::1' && !ip.startsWith('127.') && !ip.startsWith('::ffff:127.')) {
    fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,isp`)
      .then((response) => response.json())
      .then(async (geo) => {
        if (geo.status !== 'success') {
          return;
        }

        const resolved = analyticsData.recentVisitors.find((visitor) => visitor.ip === ip);
        if (resolved) {
          resolved.location = [geo.city, geo.regionName, geo.country].filter(Boolean).join(', ');
          resolved.countryCode = geo.countryCode;
          resolved.isp = geo.isp;
          resolved.flag = `https://flagcdn.com/24x18/${geo.countryCode.toLowerCase()}.png`;
        }

        const country = geo.country || 'Unknown';
        analyticsData.countryStats[country] = (analyticsData.countryStats[country] || 0) + 1;
        await persistAnalytics();
      })
      .catch(() => {});
  }
}

export async function getStats() {
  await ensureAnalyticsReady();

  const today = getTodayKey();
  const history = Object.keys(analyticsData.dailyStats)
    .sort()
    .slice(-7)
    .map((date) => ({
      date,
      views: analyticsData.dailyStats[date].views,
      visitors: analyticsData.dailyStats[date].uniqueIps.length,
    }));

  const now = new Date();
  const hourlyHistory = [];
  for (let i = 23; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * 60 * 60 * 1000);
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    const hourKey = `${dateKey}T${String(date.getUTCHours()).padStart(2, '0')}:00`;
    hourlyHistory.push({
      hour: `${String(date.getUTCHours()).padStart(2, '0')}:00`,
      views: analyticsData.hourlyStats[hourKey] || 0,
    });
  }

  const topCountries = Object.entries(analyticsData.countryStats || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }));

  const topBrowsers = Object.entries(analyticsData.browserStats || {})
    .sort(([, a], [, b]) => b - a)
    .map(([browser, count]) => ({ browser, count }));

  const deviceBreakdown = Object.entries(analyticsData.deviceStats || {})
    .sort(([, a], [, b]) => b - a)
    .map(([device, count]) => ({ device, count }));

  return {
    serverStartTime: SERVER_START_TIME,
    totalViews: analyticsData.totalViews,
    totalVisitors: analyticsData.distinctVisitors,
    todayViews: analyticsData.dailyStats[today]?.views || 0,
    todayVisitors: analyticsData.dailyStats[today]?.uniqueIps.length || 0,
    history,
    hourlyHistory,
    topCountries,
    topBrowsers,
    deviceBreakdown,
    recentVisitors: analyticsData.recentVisitors || [],
  };
}
