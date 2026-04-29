import crypto from 'node:crypto';
import { buildFingerprint } from './dedupe.js';
import {
  extractKnownLocationFromText,
  extractKnownLocationsFromText,
  findKnownLocation,
  resolveCoordinates,
} from './coordinates.js';

const ARABIC = {
  explosion: '\u062a\u0641\u062c\u064a\u0631',
  blast: '\u0627\u0646\u0641\u062c\u0627\u0631',
  demolition: '\u0646\u0633\u0641',
  shelling: '\u0642\u0635\u0641',
  raid: '\u063a\u0627\u0631\u0629',
  raids: '\u063a\u0627\u0631\u062a\u064a\u0646',
  targeting: '\u0627\u0633\u062a\u0647\u062f\u0627\u0641',
  drone: '\u0645\u0633\u064a\u0631\u0629',
  droneMasculine: '\u0645\u0633\u064a\u0631',
  missileFall: '\u0633\u0642\u0648\u0637 \u0635\u0627\u0631\u0648\u062e',
  warplane: '\u0645\u0642\u0627\u062a\u0644\u0627\u062a_\u062d\u0631\u0628\u064a\u0629',
  warplaneText: '\u0627\u0644\u0637\u064a\u0631\u0627\u0646 \u0627\u0644\u062d\u0631\u0628\u064a',
  car: '\u0633\u064a\u0627\u0631\u0629',
  vehicle: '\u0645\u0631\u0643\u0628\u0629',
  motorcycle: '\u062f\u0631\u0627\u062c\u0629',
  jeep: '\u062c\u064a\u0628',
  van: '\u0641\u0627\u0646',
  pickup: '\u0628\u064a\u0643 \u0627\u0628',
  machine: '\u0622\u0644\u064a\u0629',
  machineAlt: '\u0627\u0644\u064a\u0629',
  truck: '\u0634\u0627\u062d\u0646\u0629',
  injuries: '\u0627\u0635\u0627\u0628\u0627\u062a',
  warning: '\u0627\u0646\u0630\u0627\u0631',
  urgentWarning: '\u0627\u0646\u0630\u0627\u0631 \u0639\u0627\u062c\u0644',
  evacuation: '\u0627\u062e\u0644\u0627\u0621',
  residents: '\u0633\u0643\u0627\u0646',
  villages: '\u0627\u0644\u0642\u0631\u0649',
  towns: '\u0627\u0644\u0628\u0644\u062f\u0627\u062a',
};

const LOCATION_PREFIXES = [
  '\u0641\u064a',
  '\u0639\u0644\u0649',
  '\u0625\u0644\u0649',
  '\u0627\u0644\u0649',
  '\u0646\u062d\u0648',
  '\u0623\u0637\u0631\u0627\u0641',
  '\u0627\u0637\u0631\u0627\u0641',
  '\u0628',
  '\u0628\u0640',
];

const LOCATION_LABELS = [
  '\u0628\u0644\u062f\u0629',
  '\u0645\u062f\u064a\u0646\u0629',
  '\u0645\u0646\u0637\u0642\u0629',
  '\u0642\u0631\u064a\u0629',
  '\u0628\u0644\u062f\u0629',
  '\u0637\u0631\u064a\u0642 \u0639\u0627\u0645',
  '\u0637\u0631\u064a\u0642',
  '\u0637\u0631\u064a\u0642 \u0645\u0646\u0637\u0642\u0629',
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

function normalizeArabicText(value) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function includesArabic(text, token) {
  return normalizeArabicText(text).includes(normalizeArabicText(token));
}

function hasVehicleMention(text) {
  const normalized = normalizeArabicText(text);
  return (
    includesArabic(text, ARABIC.car) ||
    includesArabic(text, ARABIC.vehicle) ||
    includesArabic(text, ARABIC.motorcycle) ||
    includesArabic(text, ARABIC.jeep) ||
    includesArabic(text, ARABIC.van) ||
    includesArabic(text, ARABIC.pickup) ||
    includesArabic(text, ARABIC.machine) ||
    includesArabic(text, ARABIC.machineAlt) ||
    includesArabic(text, ARABIC.truck) ||
    normalized.includes('\u0633\u064a\u0627\u0631\u0647') ||
    normalized.includes('\u0645\u0631\u0643\u0628\u0647') ||
    normalized.includes('\u062f\u0631\u0627\u062c\u0647') ||
    normalized.includes('\u062c\u064a\u0628') ||
    normalized.includes('\u0641\u0627\u0646') ||
    normalized.includes('\u0628\u064a\u0643 \u0627\u0628') ||
    normalized.includes('\u0628\u064a\u0643\u0627\u0628') ||
    normalized.includes('\u0627\u0644\u064a\u0647') ||
    normalized.includes('\u0622\u0644\u064a\u0647') ||
    normalized.includes('\u0634\u0627\u062d\u0646\u0647') ||
    /\bcar\b|\bvehicle\b|\btruck\b|\bvan\b|\bjeep\b|\bmotorcycle\b|\bbike\b|\bpickup\b/i.test(text)
  );
}

function hasVehicleAttackSignal(text) {
  const normalized = normalizeArabicText(text);
  return (
    includesArabic(text, ARABIC.targeting) ||
    normalized.includes('\u0627\u063a\u0627\u0631') ||
    normalized.includes('\u0634\u0646 \u063a\u0627\u0631') ||
    normalized.includes('\u064a\u0633\u062a\u0647\u062f\u0641') ||
    normalized.includes('\u0627\u0633\u062a\u0647\u062f\u0641') ||
    normalized.includes('\u0627\u0633\u062a\u0647\u062f\u0627\u0641') ||
    normalized.includes('\u0642\u0635\u0641') ||
    normalized.includes('\u0636\u0631\u0628') ||
    normalized.includes('\u0627\u0633\u062a\u0647\u062f\u0627\u0641\u0647') ||
    normalized.includes('\u0627\u0633\u062a\u0647\u062f\u0641\u062a') ||
    normalized.includes('\u0627\u0635\u0627\u0628') ||
    normalized.includes('\u0627\u0644\u0639\u062f\u0648 \u0627\u0633\u062a\u0647\u062f\u0641') ||
    normalized.includes('\u0627\u0644\u0639\u062f\u0648 \u064a\u0633\u062a\u0647\u062f\u0641') ||
    includesArabic(text, ARABIC.raid) ||
    includesArabic(text, ARABIC.explosion) ||
    normalized.includes('targeting') ||
    normalized.includes('targeted') ||
    normalized.includes('targets') ||
    normalized.includes('hit') ||
    normalized.includes('struck') ||
    normalized.includes('attacked') ||
    normalized.includes('attack') ||
    normalized.includes('shelling')
  );
}

function hasDroneSignal(text) {
  const normalized = normalizeArabicText(text);
  return (
    normalized.includes(normalizeArabicText('#\u0645\u0633\u064a\u0631')) ||
    includesArabic(text, ARABIC.drone) ||
    includesArabic(text, ARABIC.droneMasculine) ||
    normalized.includes('\u0627\u0644\u0645\u0633\u064a\u0631') ||
    normalized.includes('\u0645\u0633\u064a\u0631 \u0645\u0639\u0627\u062f') ||
    normalized.includes('\u0637\u064a\u0631\u0627\u0646 \u0645\u0633\u064a\u0631') ||
    normalized.includes('drone')
  );
}

function hasExplicitWarningSignal(text) {
  const normalized = normalizeArabicText(text);

  const explicitWarningPhrases = [
    ARABIC.urgentWarning,
    ARABIC.evacuation,
    '\u0627\u0644\u0649 \u0633\u0643\u0627\u0646',
    '\u0625\u0644\u0649 \u0633\u0643\u0627\u0646',
    '\u0644\u0633\u0643\u0627\u0646',
    '\u0627\u0644\u0645\u062a\u0648\u0627\u062c\u062f\u064a\u0646 \u0641\u064a \u0627\u0644\u0642\u0631\u0649',
    '\u0627\u0644\u0645\u062a\u0648\u0627\u062c\u062f\u064a\u0646 \u0641\u064a \u0627\u0644\u0628\u0644\u062f\u0627\u062a',
  ];

  if (explicitWarningPhrases.some((phrase) => includesArabic(text, phrase))) {
    return true;
  }

  const mentionsWarningWord = includesArabic(text, ARABIC.warning) || normalized.includes('warning');
  const mentionsCivilianScope =
    includesArabic(text, ARABIC.residents) ||
    includesArabic(text, ARABIC.villages) ||
    includesArabic(text, ARABIC.towns);

  return mentionsWarningWord && mentionsCivilianScope;
}

function inferType(text) {
  const normalized = normalizeArabicText(text);
  const vehicleAttack = hasVehicleMention(text) && hasVehicleAttackSignal(text);

  if (hasExplicitWarningSignal(text)) {
    return 'warning';
  }
  // Drone and warplane detection is now handled by external API (alert-lb.com)
  
  if (vehicleAttack) {
    return 'carAttack';
  }
  if (
    includesArabic(text, ARABIC.explosion) ||
    includesArabic(text, ARABIC.blast) ||
    includesArabic(text, ARABIC.demolition) ||
    normalized.includes('demolition')
  ) {
    return 'explosion';
  }
  if (includesArabic(text, ARABIC.missileFall) || normalized.includes('missile')) {
    return 'missile';
  }
  if (
    includesArabic(text, ARABIC.raid) ||
    includesArabic(text, ARABIC.raids) ||
    includesArabic(text, ARABIC.warplaneText) ||
    includesArabic(text, ARABIC.targeting) ||
    normalized.includes('airstrike') ||
    normalized.includes('strike') ||
    normalized.includes('raid') ||
    normalized.includes('targeted')
  ) {
    return 'airstrike';
  }
  if (includesArabic(text, ARABIC.shelling) || normalized.includes('artillery') || normalized.includes('shell')) {
    return 'artillery';
  }

  return 'update';
}

function severityFromText(text) {
  const normalized = normalizeArabicText(text);
  const vehicleAttack = hasVehicleMention(text) && hasVehicleAttackSignal(text);

  if (hasExplicitWarningSignal(text)) {
    return 'high';
  }
  if (normalized.includes(normalizeArabicText('#\u0645\u0642\u0627\u062a\u0644\u0627\u062a_\u062d\u0631\u0628\u064a\u0629'))) {
    return 'high';
  }
  if (hasDroneSignal(text)) {
    return 'medium';
  }
  if (vehicleAttack) {
    return includesArabic(text, ARABIC.injuries) || /injur|casualt|killed|dead/i.test(text)
      ? 'high'
      : 'medium';
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
    includesArabic(text, ARABIC.demolition) ||
    includesArabic(text, ARABIC.shelling) ||
    hasDroneSignal(text) ||
    includesArabic(text, ARABIC.missileFall) ||
    normalized.match(/drone|shell|artillery|blast|explosion|demolition/i)
  ) {
    return 'medium';
  }

  return 'low';
}

function isConflictEvent(text) {
  const normalized = normalizeArabicText(text);
  const vehicleAttack = hasVehicleMention(text) && hasVehicleAttackSignal(text);

  return (
    vehicleAttack ||
    hasDroneSignal(text) ||
    normalized.includes(normalizeArabicText('#\u0645\u0642\u0627\u062a\u0644\u0627\u062a_\u062d\u0631\u0628\u064a\u0629')) ||
    includesArabic(text, ARABIC.explosion) ||
    includesArabic(text, ARABIC.blast) ||
    includesArabic(text, ARABIC.demolition) ||
    includesArabic(text, ARABIC.shelling) ||
    includesArabic(text, ARABIC.raid) ||
    includesArabic(text, ARABIC.raids) ||
    includesArabic(text, ARABIC.warplaneText) ||
    includesArabic(text, ARABIC.targeting) ||
    hasDroneSignal(text) ||
    hasExplicitWarningSignal(text) ||
    /strike|raid|drone|shell|artillery|missile|blast|explosion|demolition|airstrike|targeted|targeting|warning/i.test(text)
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
  const labelPattern = new RegExp(
    `(?:\\s|^)(?:\\u0623\\u0637\\u0631\\u0627\\u0641|\\u0627\\u0637\\u0631\\u0627\\u0641)?\\s*(?:${LOCATION_LABELS
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})\\s+([\\u0621-\\u064a]+(?:\\s+[\\u0621-\\u064a]+){0,2})`,
    'u'
  );
  const labelMatch = text.match(labelPattern);
  if (labelMatch) {
    const labelLocation = cleanExtractedLocation(labelMatch[1]);
    if (labelLocation && !isBlockedLocation(labelLocation)) {
      return labelLocation;
    }
  }

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

function locationIdentity(location) {
  const known = findKnownLocation(location);
  if (known) {
    return `${known.coords.lat.toFixed(4)},${known.coords.lng.toFixed(4)}`;
  }

  return normalizeArabicText(location);
}

function uniqueLocations(locations) {
  const seen = new Set();
  const unique = [];

  for (const location of locations) {
    const cleaned = cleanExtractedLocation(location);
    if (!cleaned || cleaned === 'Lebanon') {
      continue;
    }

    const identity = locationIdentity(cleaned);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    unique.push(cleaned);
  }

  return unique;
}

function extractTelegramLocations(text) {
  const locations = uniqueLocations(extractKnownLocationsFromText(text));

  if (locations.length > 0) {
    return locations;
  }

  const fallbackLocation = extractLocation(text);
  return uniqueLocations([fallbackLocation]);
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

async function buildTelegramAlert(text, sourceChannel) {
  const alerts = [];
  const locations = extractTelegramLocations(text);

  for (const location of locations) {
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
