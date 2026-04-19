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
};

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

export function estimateCoordinates(location) {
  const match = findKnownLocation(location);
  return match ? match.coords : { lat: 33.8547, lng: 35.8623 };
}
