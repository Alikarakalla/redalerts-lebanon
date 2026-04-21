import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ANALYTICS_FILE = path.resolve(process.cwd(), 'server', 'data', 'analytics.json');

// Initialize or load analytics data
let analyticsData = loadAnalytics();

function loadAnalytics() {
  try {
    if (!fs.existsSync(ANALYTICS_FILE)) {
      return { totalViews: 0, distinctVisitors: 0, dailyStats: {}, recentVisitors: [] };
    }
    return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
  } catch {
    return { totalViews: 0, distinctVisitors: 0, dailyStats: {}, recentVisitors: [] };
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

export function trackVisitor(ip, userAgent) {
  const today = getTodayKey();
  
  if (!analyticsData.dailyStats[today]) {
    analyticsData.dailyStats[today] = { views: 0, uniqueIps: [] };
  }

  const todayStats = analyticsData.dailyStats[today];
  todayStats.views += 1;
  analyticsData.totalViews += 1;

  // Hash IP to remain privacy compliant
  const ipHash = crypto.createHash('sha256').update(ip + userAgent).digest('hex');

  if (!todayStats.uniqueIps.includes(ipHash)) {
    todayStats.uniqueIps.push(ipHash);
    analyticsData.distinctVisitors += 1;
  }

  // --- Detailed Tracking ---
  if (!analyticsData.recentVisitors) {
    analyticsData.recentVisitors = [];
  }

  // Extract device broadly
  let device = 'Desktop';
  const uaLower = userAgent.toLowerCase();
  if (uaLower.includes('mobile')) device = 'Mobile';
  if (uaLower.includes('android')) device = 'Android';
  if (uaLower.includes('iphone') || uaLower.includes('ipad') || uaLower.includes('ipod')) device = 'iOS';
  if (uaLower.includes('mac os')) device = 'Mac';
  if (uaLower.includes('windows')) device = 'Windows';

  // Prevent duplicate logs for the same IP too often
  const existingIndex = analyticsData.recentVisitors.findIndex((v) => v.ip === ip);
  if (existingIndex !== -1) {
    analyticsData.recentVisitors.splice(existingIndex, 1);
  }

  const timestamp = new Date().toISOString();
  analyticsData.recentVisitors.unshift({ ip, device, timestamp, location: 'Resolving...' });
  analyticsData.recentVisitors = analyticsData.recentVisitors.slice(0, 50); // Keep last 50

  // Async location resolution (does not block response)
  if (ip && ip !== 'unknown') {
    fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`)
      .then((r) => r.json())
      .then((geo) => {
        if (geo.status === 'success') {
          const entry = analyticsData.recentVisitors.find((v) => v.ip === ip);
          if (entry) {
            entry.location = `${geo.city || 'Unknown'}, ${geo.country || 'Unknown'}`;
            saveAnalytics();
          }
        }
      })
      .catch(() => {});
  }

  saveAnalytics();
}

export function getStats() {
  const today = getTodayKey();
  const history = Object.keys(analyticsData.dailyStats)
    .sort()
    .slice(-7) // Last 7 days
    .map(date => ({
      date,
      views: analyticsData.dailyStats[date].views,
      visitors: analyticsData.dailyStats[date].uniqueIps.length
    }));

  return {
    totalViews: analyticsData.totalViews,
    totalVisitors: analyticsData.distinctVisitors,
    todayViews: analyticsData.dailyStats[today]?.views || 0,
    todayVisitors: analyticsData.dailyStats[today]?.uniqueIps.length || 0,
    history,
    recentVisitors: analyticsData.recentVisitors || []
  };
}
