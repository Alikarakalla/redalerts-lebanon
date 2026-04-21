import fs from 'node:fs';
import path from 'node:path';

const CITY_COORDINATES = {
  beirut: { lat: 33.8938, lng: 35.5018 },
  '\u0628\u064a\u0631\u0648\u062a': { lat: 33.8938, lng: 35.5018 },
  tyre: { lat: 33.2704, lng: 35.2038 },
  sour: { lat: 33.2704, lng: 35.2038 },
  '\u0635\u0648\u0631': { lat: 33.2704, lng: 35.2038 },
  sidon: { lat: 33.5606, lng: 35.3756 },
  saida: { lat: 33.5606, lng: 35.3756 },
  '\u0635\u064a\u062f\u0627': { lat: 33.5606, lng: 35.3756 },
  nabatieh: { lat: 33.3789, lng: 35.4834 },
  '\u0627\u0644\u0646\u0628\u0637\u064a\u0629': { lat: 33.3789, lng: 35.4834 },
  tripoli: { lat: 34.4335, lng: 35.8441 },
  trablous: { lat: 34.4335, lng: 35.8441 },
  '\u0637\u0631\u0627\u0628\u0644\u0633': { lat: 34.4335, lng: 35.8441 },
  baalbek: { lat: 34.006, lng: 36.2181 },
  '\u0628\u0639\u0644\u0628\u0643': { lat: 34.006, lng: 36.2181 },
  'bint jbeil': { lat: 33.1194, lng: 35.4331 },
  '\u0628\u0646\u062a \u062c\u0628\u064a\u0644': { lat: 33.1194, lng: 35.4331 },
  marjayoun: { lat: 33.3603, lng: 35.5919 },
  '\u0645\u0631\u062c\u0639\u064a\u0648\u0646': { lat: 33.3603, lng: 35.5919 },
  khiam: { lat: 33.3306, lng: 35.6508 },
  '\u0627\u0644\u062e\u064a\u0627\u0645': { lat: 33.3306, lng: 35.6508 },
  aitaroun: { lat: 33.1071, lng: 35.4675 },
  '\u0639\u064a\u062a\u0631\u0648\u0646': { lat: 33.1071, lng: 35.4675 },
  naqoura: { lat: 33.1181, lng: 35.1398 },
  '\u0627\u0644\u0646\u0627\u0642\u0648\u0631\u0629': { lat: 33.1181, lng: 35.1398 },
  zahrani: { lat: 33.4886, lng: 35.3225 },
  '\u0627\u0644\u0632\u0647\u0631\u0627\u0646\u064a': { lat: 33.4886, lng: 35.3225 },
  hermel: { lat: 34.395, lng: 36.3847 },
  '\u0627\u0644\u0647\u0631\u0645\u0644': { lat: 34.395, lng: 36.3847 },
  hasbaya: { lat: 33.3978, lng: 35.6857 },
  '\u062d\u0627\u0635\u0628\u064a\u0627': { lat: 33.3978, lng: 35.6857 },
  bayyada: { lat: 33.20417, lng: 35.32833 },
  bayyad: { lat: 33.20417, lng: 35.32833 },
  '\u0627\u0644\u0628\u064a\u0627\u0636\u0629': { lat: 33.20417, lng: 35.32833 },
  'mays al jabal': { lat: 33.1198, lng: 35.52 },
  'mais al jabal': { lat: 33.1198, lng: 35.52 },
  'meiss el jabal': { lat: 33.1198, lng: 35.52 },
  '\u0645\u064a\u0633 \u0627\u0644\u062c\u0628\u0644': { lat: 33.1198, lng: 35.52 },
  'qaqaiyet el jisr': { lat: 33.503, lng: 35.442 },
  'qaqaiyat al jisr': { lat: 33.503, lng: 35.442 },
  '\u0642\u0639\u0642\u0639\u064a\u0629 \u0627\u0644\u062c\u0633\u0631': { lat: 33.503, lng: 35.442 },
  shebaa: { lat: 33.3717, lng: 35.6853 },
  '\u0634\u0628\u0639\u0627': { lat: 33.3717, lng: 35.6853 },
  kfarchouba: { lat: 33.3693, lng: 35.7327 },
  'kfar chouba': { lat: 33.3693, lng: 35.7327 },
  '\u0643\u0641\u0631\u0634\u0648\u0628\u0627': { lat: 33.3693, lng: 35.7327 },
  tayrfalsayh: { lat: 33.2656, lng: 35.3732 },
  tayrfelsiyeh: { lat: 33.2656, lng: 35.3732 },
  '\u0637\u064a\u0631\u0641\u0644\u0633\u064a\u0647': { lat: 33.2656, lng: 35.3732 },
  'wadi al jaar': { lat: 33.2415, lng: 35.2508 },
  'wadi al ja ar': { lat: 33.2415, lng: 35.2508 },
  '\u0648\u0627\u062f\u064a \u0627\u0644\u062c\u0639\u0627\u0631': { lat: 33.2415, lng: 35.2508 },
  jouaiya: { lat: 33.2403, lng: 35.3875 },
  jwayya: { lat: 33.2403, lng: 35.3875 },
  '\u062c\u0648\u064a\u0627': { lat: 33.2403, lng: 35.3875 },
  'borj rahhal': { lat: 33.2806, lng: 35.2758 },
  '\u0628\u0631\u062c \u0631\u062d\u0627\u0644': { lat: 33.2806, lng: 35.2758 },
  abbasiyyeh: { lat: 33.2781, lng: 35.2864 },
  '\u0627\u0644\u0639\u0628\u0627\u0633\u064a\u0629': { lat: 33.2781, lng: 35.2864 },
};

const CACHE_FILE = path.resolve(process.cwd(), 'server', 'data', 'location-cache.json');
const locationCache = loadLocationCache();

function loadLocationCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveLocationCache() {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(locationCache, null, 2), 'utf8');
  } catch {
    // Best-effort cache only.
  }
}

function normalizeLocation(location) {
  if (!location) {
    return { normalized: '', normalizedWithoutArticle: '' };
  }

  const normalized = location.trim().toLowerCase();
  const arabicArticle = '\u0627\u0644';
  const normalizedWithoutArticle = normalized.startsWith(arabicArticle)
    ? normalized.slice(arabicArticle.length)
    : normalized;

  return { normalized, normalizedWithoutArticle };
}

function normalizeQuery(location) {
  return location
    .replace(/_/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function findKnownLocation(location) {
  const { normalized, normalizedWithoutArticle } = normalizeLocation(location);

  if (!normalized) {
    return null;
  }

  if (CITY_COORDINATES[normalized]) {
    return {
      key: normalized,
      coords: CITY_COORDINATES[normalized],
    };
  }

  if (CITY_COORDINATES[normalizedWithoutArticle]) {
    return {
      key: normalizedWithoutArticle,
      coords: CITY_COORDINATES[normalizedWithoutArticle],
    };
  }

  const partialMatch = Object.entries(CITY_COORDINATES).find(
    ([city]) =>
      normalized.includes(city) ||
      city.includes(normalized) ||
      normalizedWithoutArticle.includes(city) ||
      city.includes(normalizedWithoutArticle)
  );

  if (!partialMatch) {
    return null;
  }

  return {
    key: partialMatch[0],
    coords: partialMatch[1],
  };
}

export function isKnownLebanonLocation(location) {
  return Boolean(findKnownLocation(location));
}

export function extractKnownLocationFromText(text) {
  if (!text) {
    return null;
  }

  const normalizedText = text.trim().toLowerCase();
  const candidates = Object.keys(CITY_COORDINATES)
    .sort((left, right) => right.length - left.length)
    .filter((city) => normalizedText.includes(city));

  if (candidates.length === 0) {
    return null;
  }

  return candidates[0];
}

export function extractKnownLocationsFromText(text) {
  if (!text) {
    return [];
  }

  const normalizedText = text.trim().toLowerCase();
  const candidates = Object.keys(CITY_COORDINATES)
    .sort((left, right) => right.length - left.length)
    .filter((city) => normalizedText.includes(city));

  return [...new Set(candidates)];
}

export function estimateCoordinates(location) {
  const match = findKnownLocation(location);
  return match ? match.coords : { lat: 33.8547, lng: 35.8623 };
}

async function geocodeLebanonLocation(location) {
  const query = normalizeQuery(location);
  if (!query) {
    return null;
  }

  const cached = locationCache[query.toLowerCase()];
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=lb&q=${encodeURIComponent(`${query}, Lebanon`)}`,
      {
        headers: {
          'User-Agent': 'lebanon-news-tracker/1.0',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first?.lat || !first?.lon) {
      return null;
    }

    const result = {
      lat: Number(first.lat),
      lng: Number(first.lon),
      resolved: true,
      source: 'nominatim',
      label: query,
    };

    locationCache[query.toLowerCase()] = result;
    saveLocationCache();
    return result;
  } catch {
    return null;
  }
}

export async function resolveCoordinates(location) {
  const match = findKnownLocation(location);
  if (match) {
    return {
      ...match.coords,
      resolved: true,
      source: 'builtin',
      label: location,
    };
  }

  const geocoded = await geocodeLebanonLocation(location);
  if (geocoded) {
    return geocoded;
  }

  return {
    lat: 33.8547,
    lng: 35.8623,
    resolved: false,
    source: 'fallback',
    label: location,
  };
}
