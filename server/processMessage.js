import crypto from 'node:crypto';
import { buildFingerprint } from './dedupe.js';
import {
  extractKnownLocationFromText,
  extractKnownLocationsFromText,
  resolveCoordinates,
} from './coordinates.js';

const ARABIC = {
  explosion: '\u062a\u0641\u062c\u064a\u0631',
  blast: '\u0627\u0646\u0641\u062c\u0627\u0631',
  shelling: '\u0642\u0635\u0641',
  raid: '\u063a\u0627\u0631\u0629',
  targeting: '\u0627\u0633\u062a\u0647\u062f\u0627\u0641',
  drone: '\u0645\u0633\u064a\u0631\u0629',
  missileFall: '\u0633\u0642\u0648\u0637 \u0635\u0627\u0631\u0648\u062e',
  warplane: '\u0645\u0642\u0627\u062a\u0644\u0627\u062a_\u062d\u0631\u0628\u064a\u0629',
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

  if (text.includes('#\u0645\u0642\u0627\u062a\u0644\u0627\u062a_\u062d\u0631\u0628\u064a\u0629')) {
    return 'warplane';
  }
  if (text.includes('#\u0645\u0633\u064a\u0631')) {
    return 'drone';
  }
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

  if (text.includes('#\u0645\u0642\u0627\u062a\u0644\u0627\u062a_\u062d\u0631\u0628\u064a\u0629')) {
    return 'high';
  }
  if (text.includes('#\u0645\u0633\u064a\u0631')) {
    return 'medium';
  }

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
    text.includes('#\u0645\u0633\u064a\u0631') ||
    text.includes('#\u0645\u0642\u0627\u062a\u0644\u0627\u062a_\u062d\u0631\u0628\u064a\u0629') ||
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
  const knownLocation = extractKnownLocationFromText(text);
  if (knownLocation) {
    return knownLocation;
  }

  const arabicLocation = extractArabicLocation(text);
  if (arabicLocation) {
    return arabicLocation;
  }

  const englishLocationMatch = text.match(
    /\b(Beirut|Tyre|Sour|Sidon|Saida|Nabatieh|Baalbek|Tripoli|Bint Jbeil|Marjayoun|Khiam|Hasbaya|Naqoura|Bayyada|Bayyad)\b/i
  );

  return englishLocationMatch ? englishLocationMatch[0] : 'Lebanon';
}

function isRedLinkChannel(sourceChannel) {
  return typeof sourceChannel === 'string' && sourceChannel.toLowerCase().includes('redlinkleb');
}

function normalizeHashtagValue(value) {
  return value
    .replace(/^#+/u, '')
    .replace(/_/gu, ' ')
    .trim()
    .toLowerCase();
}

function extractHashtagLocations(text) {
  const matches = text.match(/#[^\s#]+/gu) ?? [];
  const blockedTags = new Set([
    '\u0645\u0633\u064a\u0631',
    '\u0645\u0642\u0627\u062a\u0644\u0627\u062a \u062d\u0631\u0628\u064a\u0629',
    '\u0627\u0644\u062c\u0646\u0648\u0628',
    '\u062d\u0644\u0642',
    '\u062d\u0644\u0642 \u0648\u062d\u0630\u0631',
    '\u062d\u064a\u0637\u0629 \u0648\u062d\u0630\u0631',
  ]);

  return matches
    .map(normalizeHashtagValue)
    .filter((tag) => tag && !blockedTags.has(tag))
    .filter((tag, index, all) => all.indexOf(tag) === index);
}

async function buildAlertForLocation(text, sourceChannel, location, forcedType) {
  const coords = await resolveCoordinates(location);
  const severity = severityFromText(text);
  const type = forcedType ?? inferType(text);

  return {
    id: crypto.randomUUID(),
    type,
    lat: coords.lat,
    lng: coords.lng,
    timestamp: new Date().toISOString(),
    locationName: location,
    description: text.slice(0, 320),
    verified: false,
    severity,
    sourceChannel,
    resolvedLocation: coords.resolved,
    locationSource: coords.source,
    reliabilityScore: 1,
    alertLevel: severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'yellow',
    sourceFingerprint: buildFingerprint({ sourceChannel, text, location, type }),
  };
}

async function buildRedLinkAlerts(text, sourceChannel) {
  const forcedType = text.includes('#\u0645\u0642\u0627\u062a\u0644\u0627\u062a_\u062d\u0631\u0628\u064a\u0629')
    ? 'warplane'
    : text.includes('#\u0645\u0633\u064a\u0631')
      ? 'drone'
      : inferType(text);

  const hashtagLocations = extractHashtagLocations(text);
  const knownLocations = extractKnownLocationsFromText(text);
  const locations = [...new Set([...hashtagLocations, ...knownLocations])];

  if (locations.length === 0) {
    const fallbackLocation = extractLocation(text);
    if (fallbackLocation && fallbackLocation !== 'Lebanon') {
      locations.push(fallbackLocation);
    }
  }

  const alerts = [];
  for (const location of locations) {
    alerts.push(await buildAlertForLocation(text, sourceChannel, location, forcedType));
  }
  return alerts;
}

async function buildTelegramAlert(text, sourceChannel) {
  const location = extractLocation(text);
  const alerts = [];

  if (isRedLinkChannel(sourceChannel)) {
    alerts.push(...(await buildRedLinkAlerts(text, sourceChannel)));
  } else {
    alerts.push(await buildAlertForLocation(text, sourceChannel, location));
  }

  return {
    isConflictEvent: isConflictEvent(text),
    alerts,
  };
}

export async function processMessage(text, sourceChannel) {
  return buildTelegramAlert(text, sourceChannel);
}

export function getMappableAlerts(processed) {
  if (!processed?.isConflictEvent || !Array.isArray(processed.alerts)) {
    return [];
  }

  return processed.alerts.filter((alert) => {
    if (!alert || alert.type === 'update') {
      return false;
    }

    if (!alert.locationName || alert.locationName === 'Lebanon') {
      return false;
    }

    if (!alert.resolvedLocation) {
      return false;
    }

    return true;
  });
}
