import crypto from 'node:crypto';

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFingerprint({ sourceChannel, text, location }) {
  const normalized = [sourceChannel || '', location || '', normalizeText(text)].join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function isLikelyDuplicate(candidate, existingAlerts) {
  const candidateTime = new Date(candidate.timestamp).getTime();

  return existingAlerts.some((alert) => {
    const sameLocation =
      (alert.locationName || '').toLowerCase() === (candidate.locationName || '').toLowerCase();
    const sameSummary = normalizeText(alert.description) === normalizeText(candidate.description);
    const sameFingerprint = alert.sourceFingerprint && alert.sourceFingerprint === candidate.sourceFingerprint;
    const withinWindow =
      Math.abs(new Date(alert.timestamp).getTime() - candidateTime) <= 20 * 60 * 1000;

    return sameFingerprint || (withinWindow && sameLocation && sameSummary);
  });
}
