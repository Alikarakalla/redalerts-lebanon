import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ANALYTICS_FILE = path.resolve(process.cwd(), 'server', 'data', 'analytics.json');
const SERVER_START_TIME = new Date().toISOString();

// Initialize or load analytics data
let analyticsData = loadAnalytics();

function loadAnalytics() {
  try {
    if (!fs.existsSync(ANALYTICS_FILE)) {
      return { totalViews: 0, distinctVisitors: 0, dailyStats: {}, recentVisitors: [], deviceStats: {}, countryStats: {}, browserStats: {}, hourlyStats: {} };
    }
    const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    if (!data.deviceStats) data.deviceStats = {};
    if (!data.countryStats) data.countryStats = {};
    if (!data.browserStats) data.browserStats = {};
    if (!data.hourlyStats) data.hourlyStats = {};
    if (!data.recentVisitors) data.recentVisitors = [];
    return data;
  } catch {
    return { totalViews: 0, distinctVisitors: 0, dailyStats: {}, recentVisitors: [], deviceStats: {}, countryStats: {}, browserStats: {}, hourlyStats: {} };
  }
}

function saveAnalytics() {
  try {
    fs.mkdirSync(path.dirname(ANALYTICS_FILE), { recursive: true });
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analyticsData, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save analytics', error);
  }
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

  // Device
  let device = 'Desktop';
  if (u.includes('ipad')) device = 'iPad';
  else if (u.includes('iphone') || u.includes('ipod')) device = 'iPhone';
  else if (u.includes('android') && u.includes('mobile')) device = 'Android Phone';
  else if (u.includes('android')) device = 'Android Tablet';
  else if (u.includes('mobile')) device = 'Mobile';

  // OS
  let os = 'Unknown';
  if (u.includes('windows nt 10') || u.includes('windows 10')) os = 'Windows 10/11';
  else if (u.includes('windows nt 6.3') || u.includes('windows 8.1')) os = 'Windows 8.1';
  else if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os x') || u.includes('macos')) os = 'macOS';
  else if (u.includes('iphone') || u.includes('ipad') || u.includes('ipod')) os = 'iOS';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('linux')) os = 'Linux';

  // Browser
  let browser = 'Unknown';
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('opr/') || u.includes('opera')) browser = 'Opera';
  else if (u.includes('chrome') && !u.includes('chromium')) browser = 'Chrome';
  else if (u.includes('safari') && !u.includes('chrome')) browser = 'Safari';
  else if (u.includes('firefox')) browser = 'Firefox';
  else if (u.includes('samsung')) browser = 'Samsung Browser';

  return { device, os, browser };
}

export function trackVisitor(ip, userAgent) {
  const today = getTodayKey();
  const hour = getCurrentHour();

  if (!analyticsData.dailyStats[today]) {
    analyticsData.dailyStats[today] = { views: 0, uniqueIps: [] };
  }

  const todayStats = analyticsData.dailyStats[today];
  todayStats.views += 1;
  analyticsData.totalViews += 1;

  // Hourly stats
  const hourKey = `${today}T${hour}`;
  if (!analyticsData.hourlyStats[hourKey]) {
    analyticsData.hourlyStats[hourKey] = 0;
  }
  analyticsData.hourlyStats[hourKey] += 1;

  // Hash IP to fingerprint unique visitors (privacy-safe)
  const ipHash = crypto.createHash('sha256').update(ip + userAgent).digest('hex');
  if (!todayStats.uniqueIps.includes(ipHash)) {
    todayStats.uniqueIps.push(ipHash);
    analyticsData.distinctVisitors += 1;
  }

  const { device, os, browser } = parseUserAgent(userAgent);

  // Device stats
  analyticsData.deviceStats[device] = (analyticsData.deviceStats[device] || 0) + 1;

  // Browser stats
  analyticsData.browserStats[browser] = (analyticsData.browserStats[browser] || 0) + 1;

  // Update recent visitors list (deduplicate by IP, move to top)
  const existingIndex = analyticsData.recentVisitors.findIndex((v) => v.ip === ip);
  if (existingIndex !== -1) {
    analyticsData.recentVisitors.splice(existingIndex, 1);
  }

  const entry = { ip, device, os, browser, timestamp: new Date().toISOString(), location: null, flag: null };
  analyticsData.recentVisitors.unshift(entry);
  analyticsData.recentVisitors = analyticsData.recentVisitors.slice(0, 100);

  // Async location resolution
  if (ip && ip !== 'unknown' && ip !== '::1' && !ip.startsWith('127.') && !ip.startsWith('::ffff:127.')) {
    fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,isp`)
      .then((r) => r.json())
      .then((geo) => {
        if (geo.status === 'success') {
          const resolved = analyticsData.recentVisitors.find((v) => v.ip === ip);
          if (resolved) {
            resolved.location = [geo.city, geo.regionName, geo.country].filter(Boolean).join(', ');
            resolved.countryCode = geo.countryCode;
            resolved.isp = geo.isp;
            resolved.flag = `https://flagcdn.com/24x18/${geo.countryCode.toLowerCase()}.png`;
          }
          // Country stats
          const country = geo.country || 'Unknown';
          analyticsData.countryStats[country] = (analyticsData.countryStats[country] || 0) + 1;
          saveAnalytics();
        }
      })
      .catch(() => {});
  }

  saveAnalytics();
}

export function getStats() {
  const today = getTodayKey();

  // Last 7 days
  const history = Object.keys(analyticsData.dailyStats)
    .sort()
    .slice(-7)
    .map(date => ({
      date,
      views: analyticsData.dailyStats[date].views,
      visitors: analyticsData.dailyStats[date].uniqueIps.length
    }));

  // Last 24 hours (by hour)
  const now = new Date();
  const hourlyHistory = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const hourKey = `${dateKey}T${String(d.getUTCHours()).padStart(2, '0')}:00`;
    hourlyHistory.push({
      hour: `${String(d.getUTCHours()).padStart(2, '0')}:00`,
      views: analyticsData.hourlyStats[hourKey] || 0
    });
  }

  // Top countries (sorted by count, top 10)
  const topCountries = Object.entries(analyticsData.countryStats || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }));

  // Top browsers (sorted)
  const topBrowsers = Object.entries(analyticsData.browserStats || {})
    .sort(([, a], [, b]) => b - a)
    .map(([browser, count]) => ({ browser, count }));

  // Device breakdown
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
    recentVisitors: analyticsData.recentVisitors || []
  };
}
