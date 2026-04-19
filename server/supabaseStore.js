import { sampleAlerts } from './sampleData.js';
import { isLikelyDuplicate } from './dedupe.js';
const memoryStore = [...sampleAlerts];

export async function getLatestAlerts(limit = 50) {
  return [...memoryStore]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function saveAlert(alert) {
  const existingAlerts = await getLatestAlerts(100);

  if (isLikelyDuplicate(alert, existingAlerts)) {
    return { saved: false, reason: 'duplicate' };
  }

  memoryStore.unshift(alert);
  memoryStore.splice(100);
  return { saved: true, alert };
}

export function getStorageMode() {
  return 'memory';
}
