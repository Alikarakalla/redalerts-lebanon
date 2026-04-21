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
  // ─── South Lebanon (Jnoub) Massively Expanded ─────────────────────────────
  'alma el shaab': { lat: 33.1825, lng: 35.2133 },
  'alma ash shaab': { lat: 33.1825, lng: 35.2133 },
  'علما الشعب': { lat: 33.1825, lng: 35.2133 },
  'ayta ash shaab': { lat: 33.1928, lng: 35.3172 },
  'عيتا الشعب': { lat: 33.1928, lng: 35.3172 },
  'rmeish': { lat: 33.1353, lng: 35.3894 },
  'رميش': { lat: 33.1353, lng: 35.3894 },
  'yaroun': { lat: 33.1303, lng: 35.4047 },
  'يارون': { lat: 33.1303, lng: 35.4047 },
  'dhayra': { lat: 33.1431, lng: 35.3672 },
  'الضيرة': { lat: 33.1431, lng: 35.3672 },
  'markaba': { lat: 33.2503, lng: 35.5142 },
  'مركبا': { lat: 33.2503, lng: 35.5142 },
  'kfarkila': { lat: 33.2925, lng: 35.5753 },
  'كفركلا': { lat: 33.2925, lng: 35.5753 },
  'beit lif': { lat: 33.1592, lng: 35.4194 },
  'بيت ليف': { lat: 33.1592, lng: 35.4194 },
  'arabsalim': { lat: 33.4358, lng: 35.4903 },
  'عرب صاليم': { lat: 33.4358, lng: 35.4903 },
  'kfartibnit': { lat: 33.35, lng: 35.5167 },
  'كفرتبنيت': { lat: 33.35, lng: 35.5167 },
  'deirmimas': { lat: 33.3167, lng: 35.5333 },
  'دير ميماس': { lat: 33.3167, lng: 35.5333 },
  'qantara': { lat: 33.2833, lng: 35.4167 },
  'القنطرة': { lat: 33.2833, lng: 35.4167 },
  'majdelselm': { lat: 33.2333, lng: 35.4667 },
  'مجدل سلم': { lat: 33.2333, lng: 35.4667 },
  'yater': { lat: 33.1667, lng: 35.3167 },
  'يطر': { lat: 33.1667, lng: 35.3167 },
  'blida': { lat: 33.1333, lng: 35.5167 },
  'بليدا': { lat: 33.1333, lng: 35.5167 },
  'houla': { lat: 33.1833, lng: 35.5167 },
  'حولا': { lat: 33.1833, lng: 35.5167 },
  'taibe': { lat: 33.3167, lng: 35.4667 },
  'الطيبة': { lat: 33.3167, lng: 35.4667 },
  'marwahin': { lat: 33.1, lng: 35.2167 },
  'مروحين': { lat: 33.1, lng: 35.2167 },
  'hanin': { lat: 33.1667, lng: 35.4 },
  'حانين': { lat: 33.1667, lng: 35.4 },
  'beityahoun': { lat: 33.2167, lng: 35.4167 },
  'بيت ياحون': { lat: 33.2167, lng: 35.4167 },
  'siddiqine': { lat: 33.2044, lng: 35.295 },
  'صديقين': { lat: 33.2044, lng: 35.295 },
  'qana': { lat: 33.2094, lng: 35.2978 },
  'قانا': { lat: 33.2094, lng: 35.2978 },
  'debel': { lat: 33.1364, lng: 35.3217 },
  'دبل': { lat: 33.1364, lng: 35.3217 },
  'aytaroun': { lat: 33.1167, lng: 35.4667 },
  'عيترون': { lat: 33.1167, lng: 35.4667 },
  'tebnine': { lat: 33.2106, lng: 35.4103 },
  'تبنين': { lat: 33.2106, lng: 35.4103 },
  'haris': { lat: 33.1956, lng: 35.3342 },
  'حاريص': { lat: 33.1956, lng: 35.3342 },
  'rabb el talatine': { lat: 33.2667, lng: 35.5333 },
  'رب ثلاثين': { lat: 33.2667, lng: 35.5333 },
  'odaiseh': { lat: 33.2667, lng: 35.55 },
  'العديسة': { lat: 33.2667, lng: 35.55 },
  'adaisseh': { lat: 33.2667, lng: 35.55 },
  'houla': { lat: 33.2167, lng: 35.5167 },
  'markaba': { lat: 33.2333, lng: 35.5167 },
  'talloussa': { lat: 33.25, lng: 35.5 },
  'طلوسة': { lat: 33.25, lng: 35.5 },
  'bani haiyaan': { lat: 33.2667, lng: 35.4833 },
  'بني حيان': { lat: 33.2667, lng: 35.4833 },
  'touline': { lat: 33.2833, lng: 35.45 },
  'تولين': { lat: 33.2833, lng: 35.45 },
  'qabrikha': { lat: 33.3, lng: 35.45 },
  'قبريخا': { lat: 33.3, lng: 35.45 },
  'ghandouriyeh': { lat: 33.3167, lng: 35.4333 },
  'الغندورية': { lat: 33.3167, lng: 35.4333 },
  'zawtar el charqiyeh': { lat: 33.3333, lng: 35.4833 },
  'زوطر الشرقية': { lat: 33.3333, lng: 35.4833 },
  'zawtar el gharbiyeh': { lat: 33.3333, lng: 35.4667 },
  'زوطر الغربية': { lat: 33.3333, lng: 35.4667 },
  'majdel zoun': { lat: 33.15, lng: 35.1833 },
  'مجدل زون': { lat: 33.15, lng: 35.1833 },
  'shama': { lat: 33.1692, lng: 35.1765 },
  'شمع': { lat: 33.1692, lng: 35.1765 },
  'jibbayn': { lat: 33.1167, lng: 35.2167 },
  'جبين': { lat: 33.1167, lng: 35.2167 },
  'yarine': { lat: 33.1, lng: 35.25 },
  'يارين': { lat: 33.1, lng: 35.25 },
  'tair harfa': { lat: 33.1167, lng: 35.1833 },
  'طير حرفا': { lat: 33.1167, lng: 35.1833 },
  'wadi hamoul': { lat: 33.1, lng: 35.15 },
  'وادي حمول': { lat: 33.1, lng: 35.15 },
  'shihin': { lat: 33.1167, lng: 35.2333 },
  'شيحين': { lat: 33.1167, lng: 35.2333 },
  'oum el tout': { lat: 33.1167, lng: 35.2667 },
  'أم التوت': { lat: 33.1167, lng: 35.2667 },
  'bustane': { lat: 33.1167, lng: 35.2833 },
  'بستان': { lat: 33.1167, lng: 35.2833 },
  'ramyeh': { lat: 33.1, lng: 35.3167 },
  'رامية': { lat: 33.1, lng: 35.3167 },
  'beityahoun': { lat: 33.2, lng: 35.4 },
  'بيت ياحون': { lat: 33.2, lng: 35.4 },
  'baraachit': { lat: 33.2167, lng: 35.45 },
  'برعشيت': { lat: 33.2167, lng: 35.45 },
  'shaqra': { lat: 33.2333, lng: 35.4833 },
  'شقرا': { lat: 33.2333, lng: 35.4833 },
  'houla': { lat: 33.2167, lng: 35.5 },
  'بافليه': { lat: 33.2667, lng: 35.3333 },
  'baflieh': { lat: 33.2667, lng: 35.3333 },
  'srifa': { lat: 33.2833, lng: 35.35 },
  'صريفا': { lat: 33.2833, lng: 35.35 },
  'arzoun': { lat: 33.2833, lng: 35.3667 },
  'ارزون': { lat: 33.2833, lng: 35.3667 },
  'derghaya': { lat: 33.2667, lng: 35.3667 },
  'درغيا': { lat: 33.2667, lng: 35.3667 },
  'chahshour': { lat: 33.25, lng: 35.3667 },
  'chhour': { lat: 33.25, lng: 35.3667 },
  'شحور': { lat: 33.25, lng: 35.3667 },
  'al houch': { lat: 33.2667, lng: 35.2167 },
  'الحوش': { lat: 33.2667, lng: 35.2167 },
  'bazouriyeh': { lat: 33.2667, lng: 35.2667 },
  'البازورية': { lat: 33.2667, lng: 35.2667 },
  'ain baal': { lat: 33.25, lng: 35.2833 },
  'عين بعال': { lat: 33.25, lng: 35.2833 },
  'batouliyeh': { lat: 33.25, lng: 35.2667 },
  'باتولية': { lat: 33.25, lng: 35.2667 },
  'hanaway': { lat: 33.2333, lng: 35.2833 },
  'هناواي': { lat: 33.2333, lng: 35.2833 },
  'maliyeh': { lat: 33.2167, lng: 35.2833 },
  'المالية': { lat: 33.2167, lng: 35.2833 },
  'zelqaya': { lat: 33.2167, lng: 35.3 },
  'زلقية': { lat: 33.2167, lng: 35.3 },
  'jibal el botm': { lat: 33.2, lng: 35.3 },
  'جبال البطم': { lat: 33.2, lng: 35.3 },

  // ─── Beqaa Massively Expanded ─────────────────────────────────────────────
  'zahle': { lat: 33.8467, lng: 35.9017 },
  'زحلة': { lat: 33.8467, lng: 35.9017 },
  'baalbek': { lat: 34.0061, lng: 36.2086 },
  'بعلبك': { lat: 34.0061, lng: 36.2086 },
  'hermel': { lat: 34.3941, lng: 36.3847 },
  'الهرمل': { lat: 34.3941, lng: 36.3847 },
  'shtaura': { lat: 33.805, lng: 35.845 },
  'شتورة': { lat: 33.805, lng: 35.845 },
  'nabi chit': { lat: 33.95, lng: 36.0833 },
  'نبي شيت': { lat: 33.95, lng: 36.0833 },
  'britel': { lat: 34.0167, lng: 36.1667 },
  'بريتال': { lat: 34.0167, lng: 36.1667 },
  'labweh': { lat: 34.1833, lng: 36.3333 },
  'لبوة': { lat: 34.1833, lng: 36.3333 },
  'arsal': { lat: 34.1833, lng: 36.4167 },
  'عرسال': { lat: 34.1833, lng: 36.4167 },
  'rayak': { lat: 33.85, lng: 36 },
  'رياق': { lat: 33.85, lng: 36 },
  'temnine el tahta': { lat: 33.8833, lng: 35.9833 },
  'تمنين التحتا': { lat: 33.8833, lng: 35.9833 },
  'temnine el fawqa': { lat: 33.9, lng: 35.9833 },
  'تمنين الفوقا': { lat: 33.9, lng: 35.9833 },
  'ali el nahri': { lat: 33.8667, lng: 35.9833 },
  'علي النهري': { lat: 33.8667, lng: 35.9833 },
  'massa': { lat: 33.85, lng: 36.05 },
  'ماسا': { lat: 33.85, lng: 36.05 },
  'janta': { lat: 33.8833, lng: 36.0833 },
  'جنتا': { lat: 33.8833, lng: 36.0833 },
  'yammoune': { lat: 34.0667, lng: 36.0167 },
  'اليمونة': { lat: 34.0667, lng: 36.0167 },
  'shmustar': { lat: 34, lng: 36 },
  'شمستار': { lat: 34, lng: 36 },
  'bodai': { lat: 34.05, lng: 36.05 },
  'بوداي': { lat: 34.05, lng: 36.05 },
  'taraya': { lat: 34, lng: 36.05 },
  'طليا': { lat: 34.0167, lng: 36.1 },
  'talia': { lat: 34.0167, lng: 36.1 },
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
