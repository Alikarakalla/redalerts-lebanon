import crypto from 'node:crypto';

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[@#]\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildComparableText(alert) {
  return normalizeText(alert.description || alert.text || '');
}

function textLooksEquivalent(left, right) {
  if (!left || !right) {
    return false;
  }

  return left === right || left.includes(right) || right.includes(left);
}

export function buildFingerprint({ text, location, type }) {
  const normalized = [type || '', location || '', normalizeText(text)].join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function isLikelyDuplicate(candidate, existingAlerts) {
  const candidateTime = new Date(candidate.timestamp).getTime();
  const candidateSummary = buildComparableText(candidate);

  return existingAlerts.some((alert) => {
    const sameLocation =
      (alert.locationName || '').toLowerCase() === (candidate.locationName || '').toLowerCase();
    const sameType = (alert.type || '').toLowerCase() === (candidate.type || '').toLowerCase();
    const alertSummary = buildComparableText(alert);
    const sameSummary = alertSummary === candidateSummary;
    const equivalentSummary = textLooksEquivalent(alertSummary, candidateSummary);
    const sameFingerprint = alert.sourceFingerprint && alert.sourceFingerprint === candidate.sourceFingerprint;
    const withinWindow =
      Math.abs(new Date(alert.timestamp).getTime() - candidateTime) <= 20 * 60 * 1000;

    return sameFingerprint || (withinWindow && sameLocation && sameType && (sameSummary || equivalentSummary));
  });
}
