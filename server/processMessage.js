import crypto from 'node:crypto';
import { buildFingerprint } from './dedupe.js';
import { estimateCoordinates, isKnownLebanonLocation } from './coordinates.js';

const ARABIC = {
  explosion: '\u062a\u0641\u062c\u064a\u0631',
  blast: '\u0627\u0646\u0641\u062c\u0627\u0631',
  shelling: '\u0642\u0635\u0641',
  raid: '\u063a\u0627\u0631\u0629',
  targeting: '\u0627\u0633\u062a\u0647\u062f\u0627\u0641',
  drone: '\u0645\u0633\u064a\u0631\u0629',
  missileFall: '\u0633\u0642\u0648\u0637 \u0635\u0627\u0631\u0648\u062e',
};

const LOCATION_PREFIXES = [
  '\u0641\u064a',
  '\u0639\u0644\u0649',
  '\u0628',
  '\u0628\u0640',
];

const LOCATION_LABELS = [
  '\u0628\u0644\u062f\u0629',
  '\u0645\u062f\u064a\u0646\u0629',
  '\u0645\u0646\u0637\u0642\u0629',
  '\u0642\u0631\u064a\u0629',
  '\u0628\u0644\u062f\u0629',
];

const LOCATION_STOP_WORDS = [
  '\u062c\u0646\u0648\u0628',
  '\u0634\u0645\u0627\u0644',
  '\u0634\u0631\u0642',
  '\u063a\u0631\u0628',
  '\u0627\u0644\u0639\u062f\u0648',
  '\u0627\u0644\u0625\u0633\u0631\u0627\u0626\u064a\u0644\u064a',
  '\u0627\u0644\u0627\u0633\u0631\u0627\u0626\u064a\u0644\u064a',
];

const LOCATION_BLOCKLIST_PREFIXES = [
  '\u062d\u0632\u0628 \u0627\u0644\u0644\u0647',
  '\u0627\u0644\u062d\u0632\u0628',
  '\u0627\u0644\u0645\u0642\u0627\u0648\u0645\u0629',
  '\u0627\u0644\u0625\u062e\u0648\u0629',
  '\u0627\u0644\u0639\u062f\u0648',
  '\u0627\u0644\u0645\u0633\u0624\u0648\u0644',
];

function includesArabic(text, token) {
  return text.includes(token);
}

function inferType(text) {
  const normalized = text.toLowerCase();

  if (includesArabic(text, ARABIC.explosion) || includesArabic(text, ARABIC.blast)) {
    return 'explosion';
  }
  if (includesArabic(text, ARABIC.missileFall) || normalized.includes('missile')) {
    return 'missile';
  }
  if (includesArabic(text, ARABIC.drone) || normalized.includes('drone')) {
    return 'drone';
  }
  if (includesArabic(text, ARABIC.shelling) || normalized.includes('artillery') || normalized.includes('shell')) {
    return 'artillery';
  }
  if (
    includesArabic(text, ARABIC.raid) ||
    includesArabic(text, ARABIC.targeting) ||
    normalized.includes('airstrike') ||
    normalized.includes('strike') ||
    normalized.includes('raid') ||
    normalized.includes('targeted')
  ) {
    return 'airstrike';
  }

  return 'update';
}

function severityFromText(text) {
  const normalized = text.toLowerCase();

  if (
    includesArabic(text, ARABIC.raid) ||
    includesArabic(text, ARABIC.targeting) ||
    normalized.match(/airstrike|missile|raid|targeted|killed|dead|casualties|martyr|martyrs/i)
  ) {
    return 'high';
  }

  if (
    includesArabic(text, ARABIC.explosion) ||
    includesArabic(text, ARABIC.blast) ||
    includesArabic(text, ARABIC.shelling) ||
    includesArabic(text, ARABIC.drone) ||
    includesArabic(text, ARABIC.missileFall) ||
    normalized.match(/drone|shell|artillery|blast|explosion/i)
  ) {
    return 'medium';
  }

  return 'low';
}

function isConflictEvent(text) {
  return (
    includesArabic(text, ARABIC.explosion) ||
    includesArabic(text, ARABIC.blast) ||
    includesArabic(text, ARABIC.shelling) ||
    includesArabic(text, ARABIC.raid) ||
    includesArabic(text, ARABIC.targeting) ||
    includesArabic(text, ARABIC.drone) ||
    includesArabic(text, ARABIC.missileFall) ||
    /strike|raid|drone|shell|artillery|missile|blast|explosion|airstrike|targeted/i.test(text)
  );
}

function cleanExtractedLocation(value) {
  let location = value
    .replace(/^[\s:،,.!؟\-]+|[\s:،,.!؟\-]+$/gu, '')
    .trim();

  for (const label of LOCATION_LABELS) {
    const prefix = `${label} `;
    if (location.startsWith(prefix)) {
      location = location.slice(prefix.length);
    }
  }

  for (const stopWord of LOCATION_STOP_WORDS) {
    const index = location.indexOf(` ${stopWord}`);
    if (index !== -1) {
      location = location.slice(0, index);
    }
  }

  return location.trim();
}

function isBlockedLocation(location) {
  if (!location) {
    return true;
  }

  return LOCATION_BLOCKLIST_PREFIXES.some(
    (prefix) => location === prefix || location.startsWith(`${prefix} `)
  );
}

function extractArabicLocation(text) {
  const escapedPrefixes = LOCATION_PREFIXES.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `(?:\\s|^)(?:${escapedPrefixes.join('|')})\\s+([\\u0621-\\u064a]+(?:\\s+[\\u0621-\\u064a]+){0,2})`,
    'u'
  );

  const match = text.match(pattern);
  if (!match) {
    return null;
  }

  const location = cleanExtractedLocation(match[1]);
  if (!location || isBlockedLocation(location)) {
    return null;
  }

  return location;
}

function extractLocation(text) {
  const arabicLocation = extractArabicLocation(text);
  if (arabicLocation) {
    return arabicLocation;
  }

  const englishLocationMatch = text.match(
    /\b(Beirut|Tyre|Sour|Sidon|Saida|Nabatieh|Baalbek|Tripoli|Bint Jbeil|Marjayoun|Khiam|Hasbaya|Naqoura|Bayyada|Bayyad)\b/i
  );

  return englishLocationMatch ? englishLocationMatch[0] : 'Lebanon';
}

function buildTelegramAlert(text, sourceChannel) {
  const location = extractLocation(text);
  const coords = estimateCoordinates(location);
  const severity = severityFromText(text);

  return {
    isConflictEvent: isConflictEvent(text),
    alert: {
      id: crypto.randomUUID(),
      type: inferType(text),
      lat: coords.lat,
      lng: coords.lng,
      timestamp: new Date().toISOString(),
      locationName: location,
      description: text.slice(0, 320),
      verified: false,
      severity,
      sourceChannel,
      reliabilityScore: 1,
      alertLevel: severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'yellow',
      sourceFingerprint: buildFingerprint({ sourceChannel, text, location }),
    },
  };
}

export async function processMessage(text, sourceChannel) {
  return buildTelegramAlert(text, sourceChannel);
}

export function isMappableAlert(processed) {
  if (!processed?.isConflictEvent) {
    return false;
  }

  if (!processed.alert || processed.alert.type === 'update') {
    return false;
  }

  if (!processed.alert.locationName || processed.alert.locationName === 'Lebanon') {
    return false;
  }

  if (!isKnownLebanonLocation(processed.alert.locationName)) {
    return false;
  }

  return true;
}
