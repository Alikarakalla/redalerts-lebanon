import React, { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Info, ChevronDown, ChevronUp, Plus, Minus, Share2, Copy, ExternalLink, Check } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MAP_TRANSLATIONS = {
  en: {
    dir: 'ltr',
    eventLabels: {
      explosion: 'Explosion',
      artillery: 'Artillery',
      airstrike: 'Airstrike',
      carAttack: 'Car Attack',
      warplane: 'Warplane',
      missile: 'Missile',
      drone: 'Drone',
      warning: 'Warning',
      default: 'Incident',
    },
    legend: 'Legend',
    fresh: 'Fresh event under 30 min',
    recent: 'Recent event under 2 hours',
    old: 'Older than 2 hours',
    incidents: 'alerts',
    incidentIn: (label, location) => `${label} in ${location}`,
    clusterSummary: (count, label, location) => `${count} ${label.toLowerCase()} alerts near ${location}`,
    typeLegend: {
      drone: 'Drone',
      warplane: 'Warplane',
      carAttack: 'Car Attack',
      strike: 'Strike / Explosion',
      warning: 'Warning / Evacuation',
    },
  },
  ar: {
    dir: 'rtl',
    eventLabels: {
      explosion: 'انفجار',
      artillery: 'قصف مدفعي',
      airstrike: 'غارة',
      carAttack: 'استهداف سيارة',
      warplane: 'مقاتلات حربية',
      missile: 'صاروخ',
      drone: 'مسيرة',
      warning: 'انذار',
      default: 'حادث',
    },
    legend: 'الدليل',
    fresh: 'حدث جديد خلال أقل من 30 دقيقة',
    recent: 'حدث حديث خلال أقل من ساعتين',
    old: 'أقدم من ساعتين',
    incidents: 'تنبيهات',
    incidentIn: (label, location) => `${label} في ${location}`,
    clusterSummary: (count, label, location) => `${count} تنبيهات ${label} قرب ${location}`,
    typeLegend: {
      drone: 'مسيرة',
      warplane: 'مقاتلات حربية',
      carAttack: 'استهداف سيارة',
      strike: 'غارة / انفجار',
      warning: 'انذار / اخلاء',
    },
  },
};

const DEFAULT_CENTER = [33.8547, 35.8623]; // Lebanon center
const DEFAULT_ZOOM = 8;
const FOCUSED_ZOOM = 11;

const LEBANON_BOUNDS = { minLng: 35.0, maxLng: 36.7, minLat: 33.0, maxLat: 34.8 };
function isInLebanon(lng, lat) {
  return lng >= LEBANON_BOUNDS.minLng && lng <= LEBANON_BOUNDS.maxLng
      && lat >= LEBANON_BOUNDS.minLat && lat <= LEBANON_BOUNDS.maxLat;
}

const TYPE_STYLES = {
  drone: { base: '#f59e0b' },
  warplane: { base: '#38bdf8' },
  airstrike: { base: '#ef4444' },
  carAttack: { base: '#22c55e' },
  artillery: { base: '#fb7185' },
  explosion: { base: '#f43f5e' },
  missile: { base: '#a78bfa' },
  warning: { base: '#ff4d00' },
  default: { base: '#94a3b8' },
};

function getLocaleTag(locale) {
  return locale === 'ar' ? 'ar-LB-u-ca-gregory' : 'en-LB';
}

function getEventAgeMinutes(timestamp) {
  return (Date.now() - new Date(timestamp).getTime()) / 60000;
}

function getAgeBucket(timestamp) {
  const ageMinutes = getEventAgeMinutes(timestamp);
  if (ageMinutes <= 30) return 'fresh';
  if (ageMinutes <= 120) return 'recent';
  return 'old';
}

function formatEventLabel(type, locale) {
  const labels = MAP_TRANSLATIONS[locale].eventLabels;
  return labels[type] ?? labels.default;
}

function formatPopupTime(timestamp, locale) {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function getMarkerStyle(type, timestamp) {
  const palette = TYPE_STYLES[type] ?? TYPE_STYLES.default;
  const ageBucket = getAgeBucket(timestamp);
  const opacity = ageBucket === 'fresh' ? 1 : ageBucket === 'recent' ? 0.78 : 0.58;

  return {
    base: palette.base,
    ringOpacity: opacity,
    fillOpacity: ageBucket === 'fresh' ? 0.34 : ageBucket === 'recent' ? 0.26 : 0.18,
  };
}

function getMarkerRadius(severity, count = 1, zoomLevel = DEFAULT_ZOOM) {
  const base = severity === 'high' ? 12 : severity === 'medium' ? 9 : 7;
  const countBoost = count <= 1 ? 0 : Math.log2(count + 1) * 3;
  const zoomScale = 0.42 + Math.max(0, Math.min(zoomLevel - 7, 7)) * 0.19;

  return Math.min((base + countBoost) * zoomScale, 30);
}

function getCoverageRadiusMeters(type, severity, count = 1) {
  const typeRadius = {
    drone: 1450,
    warplane: 2200,
    airstrike: 1250,
    carAttack: 700,
    artillery: 1100,
    explosion: 850,
    missile: 1600,
    warning: 3500,
  };
  const severityBoost = severity === 'high' ? 1.25 : severity === 'medium' ? 1.08 : 0.92;
  const clusterBoost = count <= 1 ? 1 : Math.min(1 + Math.log2(count) * 0.18, 1.55);

  return Math.round((typeRadius[type] ?? 900) * severityBoost * clusterBoost);
}

function getCoverageRadiusPixels(map, lat, lng, radiusMeters) {
  const centerPoint = map.latLngToLayerPoint([lat, lng]);
  const radiusLat = lat + radiusMeters / 111_320;
  const edgePoint = map.latLngToLayerPoint([radiusLat, lng]);

  return Math.max(Math.abs(centerPoint.y - edgePoint.y), 18);
}

function zoomToCoverageArea(map, lat, lng, radiusMeters) {
  if (!map || typeof map.flyToBounds !== 'function') {
    return;
  }

  const latLng = L.latLng(lat, lng);
  const latOffset = radiusMeters / 111_320;
  const lngOffset = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bounds = L.latLngBounds(
    [latLng.lat - latOffset, latLng.lng - lngOffset],
    [latLng.lat + latOffset, latLng.lng + lngOffset]
  );

  map.flyToBounds(bounds, {
    animate: true,
    duration: 1.1,
    maxZoom: 12,
    padding: [64, 64],
  });
}

function getSeverityScore(severity) {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function distanceKm(a, b) {
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLat = (a.lat - b.lat) * 111.32;
  const dLng = (a.lng - b.lng) * 111.32 * Math.cos(meanLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function normalizeLocationKey(locationName) {
  return String(locationName || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function dedupeNewestByVillageAndType(events) {
  const newestByKey = new Map();

  for (const event of events) {
    const key = `${normalizeLocationKey(event.locationName)}:${event.type || 'default'}`;
    const current = newestByKey.get(key);

    if (!current || new Date(event.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      newestByKey.set(key, event);
    }
  }

  return [...newestByKey.values()];
}

function offsetIncidentsWithSameVillage(incidents) {
  const grouped = incidents.reduce((groups, incident) => {
    const key = normalizeLocationKey(incident.primaryLocation);
    const group = groups.get(key) || [];
    group.push(incident);
    groups.set(key, group);
    return groups;
  }, new Map());

  for (const group of grouped.values()) {
    if (group.length <= 1) {
      continue;
    }

    const offsetMeters = 180;
    const centerIndex = (group.length - 1) / 2;

    group
      .sort((a, b) => String(a.type).localeCompare(String(b.type)))
      .forEach((incident, index) => {
        const angle = -Math.PI / 2 + ((index - centerIndex) * (Math.PI * 2)) / Math.max(group.length, 4);
        const latOffset = (Math.sin(angle) * offsetMeters) / 111_320;
        const lngOffset = (Math.cos(angle) * offsetMeters) / (111_320 * Math.cos((incident.lat * Math.PI) / 180));

        incident.lat += latOffset;
        incident.lng += lngOffset;
      });
  }

  return incidents;
}

function clusterEvents(events, locale, zoomLevel) {
  const sorted = dedupeNewestByVillageAndType(events).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const clusters = [];
  
  // Dynamic clustering based on zoom
  const radiusKm = zoomLevel >= 11 ? 1.5 : zoomLevel >= 9 ? 4 : 8;

  for (const event of sorted) {
    const existing = clusters.find(
      (cluster) => cluster.type === event.type && distanceKm(cluster, event) <= radiusKm
    );

    if (existing) {
      existing.items.push(event);
      existing.count += 1;
      existing.lat = (existing.lat * (existing.count - 1) + event.lat) / existing.count;
      existing.lng = (existing.lng * (existing.count - 1) + event.lng) / existing.count;
      existing.timestamp =
        new Date(event.timestamp) > new Date(existing.timestamp) ? event.timestamp : existing.timestamp;
      existing.severity =
        getSeverityScore(event.severity) > getSeverityScore(existing.severity) ? event.severity : existing.severity;
      existing.locationNames.add(event.locationName);
      continue;
    }

    clusters.push({
      id: `cluster-${event.type}-${event.id}`,
      type: event.type,
      lat: event.lat,
      lng: event.lng,
      timestamp: event.timestamp,
      severity: event.severity,
      count: 1,
      items: [event],
      locationNames: new Set([event.locationName]),
    });
  }

  const incidents = clusters.map((cluster) => {
    const latestItem = cluster.items[0];
    const primaryLocation = [...cluster.locationNames][0];

    return {
      id: cluster.count > 1 ? cluster.id : latestItem.id,
      kind: cluster.count > 1 ? 'cluster' : 'event',
      type: cluster.type,
      lat: cluster.lat,
      lng: cluster.lng,
      timestamp: cluster.timestamp,
      severity: cluster.severity,
      count: cluster.count,
      items: cluster.items,
      primaryLocation: primaryLocation,
      allLocations: [...cluster.locationNames],
      locationCount: cluster.locationNames.size,
      originalEvent: cluster.count === 1 ? latestItem : null,
      title:
        cluster.count > 1
          ? MAP_TRANSLATIONS[locale].clusterSummary(
              cluster.count,
              formatEventLabel(cluster.type, locale),
              primaryLocation
            )
          : MAP_TRANSLATIONS[locale].incidentIn(
              formatEventLabel(latestItem.type, locale),
              primaryLocation
        ),
    };
  });

  return offsetIncidentsWithSameVillage(incidents);
}

function buildEventSummary(incident, locale) {
  const isAr = locale === 'ar';
  const time = formatPopupTime(incident.timestamp, locale);
  const typeLabel = formatEventLabel(incident.type, locale);
  
  let summary = '';
  if (incident.kind === 'cluster') {
    const locations = incident.allLocations.join(', ');
    summary = isAr 
      ? `🔴 تحديث ميداني: ${incident.count} ${typeLabel} في مناطق: ${locations}\n⏰ التوقيت: ${time}`
      : `🔴 Field Update: ${incident.count} ${typeLabel} alerts in: ${locations}\n⏰ Time: ${time}`;
  } else {
    const description = incident.items?.[0]?.description || '';
    summary = isAr
      ? `🔴 تحديث ميداني: ${typeLabel} في ${incident.primaryLocation}\n📝 التفاصيل: ${description}\n⏰ التوقيت: ${time}`
      : `🔴 Field Update: ${typeLabel} in ${incident.primaryLocation}\n📝 Details: ${description}\n⏰ Time: ${time}`;
  }

  return `${summary}\n\n📍 لمتابعة التحديثات المباشرة:\nhttps://redalerts-lebanon.online`;
}

function ShareButton({ incident, locale }) {
  const [copied, setCopied] = useState(false);
  const isAr = locale === 'ar';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildEventSummary(incident, locale));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareText = buildEventSummary(incident, locale);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2">
      <button
        onClick={handleCopy}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 py-1.5 text-[10px] font-medium text-slate-300 transition hover:bg-white/10"
        title={isAr ? 'نسخ الملخص' : 'Copy Summary'}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        <span>{isAr ? 'نسخ' : 'Copy'}</span>
      </button>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 py-1.5 text-[10px] font-medium text-emerald-400 transition hover:bg-emerald-500/20"
      >
        <Share2 className="h-3 w-3" />
        <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
      </a>
    </div>
  );
}

function IncidentPopup({ incident, locale, t }) {
  const isCluster = incident.kind === 'cluster';
  const ageBucket = getAgeBucket(incident.timestamp);
  
  const timeColor =
    ageBucket === 'fresh' ? 'text-red-400' : ageBucket === 'recent' ? 'text-slate-300' : 'text-slate-500';

  return (
    <div className={`p-1 pt-2 w-[220px] font-sans ${MAP_TRANSLATIONS[locale].dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={MAP_TRANSLATIONS[locale].dir}>
      <h4 className="mb-1 text-[0.85rem] font-bold text-slate-100 flex items-center justify-between border-b border-white/10 pb-1">
        <span>{incident.primaryLocation}</span>
        {isCluster && <span className="text-[0.65rem] bg-white/10 px-1.5 py-0.5 rounded-full">{incident.count}</span>}
      </h4>
      
      {isCluster && (
        <div className="my-2 space-y-1">
          <p className="text-[0.65rem] text-slate-500 uppercase tracking-wider">{locale === 'ar' ? 'القرى المتأثرة:' : 'Affected villages:'}</p>
          <div className="flex flex-wrap gap-1">
            {incident.allLocations.map((loc, idx) => (
              <span key={idx} className="text-[0.7rem] text-slate-200 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                {loc}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mb-1 text-[0.7rem] font-medium text-slate-400">{formatEventLabel(incident.type, locale)}</p>
      <div className={`text-[0.65rem] font-medium ${timeColor}`}>
        {formatPopupTime(incident.timestamp, locale)}
      </div>

      <ShareButton incident={incident} locale={locale} />
    </div>
  );
}

function getEventMarkerSymbol(type) {
  if (type === 'drone') {
    return `
      <path class="event-marker__symbol-stroke" d="M16 13.5v5M13.5 16h5M10.8 10.8l3 3M21.2 10.8l-3 3M10.8 21.2l3-3M21.2 21.2l-3-3" />
      <rect x="12.2" y="12.2" width="7.6" height="7.6" rx="2.1" />
      <circle cx="8.2" cy="8.2" r="4.4" />
      <circle cx="23.8" cy="8.2" r="4.4" />
      <circle cx="8.2" cy="23.8" r="4.4" />
      <circle cx="23.8" cy="23.8" r="4.4" />
      <circle class="event-marker__symbol-cutout" cx="8.2" cy="8.2" r="2" />
      <circle class="event-marker__symbol-cutout" cx="23.8" cy="8.2" r="2" />
      <circle class="event-marker__symbol-cutout" cx="8.2" cy="23.8" r="2" />
      <circle class="event-marker__symbol-cutout" cx="23.8" cy="23.8" r="2" />
    `;
  }

  if (type === 'warplane') {
    return `
      <path d="M16 2.8 19.9 19l7.1 2.9v2.4l-9.1-1.6L16 29.2l-1.9-6.5L5 24.3v-2.4L12.1 19 16 2.8Z" />
    `;
  }

  if (type === 'missile') {
    return `
      <path d="M18.5 3.5c4.1 2.2 6.3 6.9 5.2 11.4l-7.9 7.9-6.6-6.6 7.9-7.9c.4-1.7.8-3.3 1.4-4.8Z" />
      <path d="M9.4 16.3 5.2 18l3.1 3.1M15.7 22.6 14 26.8l-3.1-3.1" />
      <path class="event-marker__symbol-stroke" d="M8.4 23.6 5.4 26.6M11.1 25.5 8.9 29" />
    `;
  }

  if (type === 'carAttack') {
    return `
      <path d="M7.2 12.7 9.5 7.8h13l2.3 4.9 2.4 1.7v8.5h-3.5v-2.4H8.3v2.4H4.8v-8.5l2.4-1.7Z" />
      <path class="event-marker__symbol-cutout" d="M10.5 10.2h11l1.1 2.6H9.4l1.1-2.6Z" />
      <circle class="event-marker__symbol-cutout" cx="10.2" cy="17.4" r="1.9" />
      <circle class="event-marker__symbol-cutout" cx="21.8" cy="17.4" r="1.9" />
    `;
  }

  if (type === 'artillery') {
    return `
      <path d="M8.3 19.9 23.8 8.8l2.1 3L10.4 22.9Z" />
      <path d="M6.7 20.5h9.5v3.7H6.7Z" />
      <circle cx="9.2" cy="25" r="3.1" />
      <circle cx="19.8" cy="25" r="3.1" />
    `;
  }

  if (type === 'airstrike') {
    return `
      <path d="m16 2.8 2.1 8.2 6.8-5-2.9 7.9 8.2.9-7.5 3.8 5.8 6.2-8.2-2-1.9 8.2-4.2-7.3-7.2 4.4 3.1-7.8-8.3-1.1 7.5-3.7-5.7-6.3 8.1 2L16 2.8Z" />
      <circle class="event-marker__symbol-cutout" cx="16" cy="16" r="3.1" />
      <circle cx="16" cy="16" r="1.4" />
    `;
  }

  if (type === 'explosion') {
    return `
      <path d="m16 3.2 2.7 7.1 6.9-3.1-3.1 6.9 7.1 2.7-7.1 2.7 3.1 6.9-6.9-3.1-2.7 7.1-2.7-7.1-6.9 3.1 3.1-6.9-7.1-2.7 7.1-2.7-3.1-6.9 6.9 3.1L16 3.2Z" />
      <circle class="event-marker__symbol-cutout" cx="16" cy="16" r="3.3" />
    `;
  }

  if (type === 'warning') {
    return `
      <path d="M16 3L2 29h28L16 3z" fill="none" stroke="#fff7ed" stroke-width="2.5" />
      <path d="M16 11v8" stroke="#fff7ed" stroke-width="3" stroke-linecap="round" />
      <circle cx="16" cy="24" r="2" fill="#fff7ed" />
    `;
  }
  return `
    <circle cx="16" cy="16" r="9" />
    <path class="event-marker__symbol-cutout" d="M15 8h2v10h-2zM15 21h2v3h-2z" />
  `;
}

const eventIcon = (type, color, opacity, count, radius, isFresh, coveragePixelRadius = 18) => {
  const usesLargeOrbit = type === 'drone' || type === 'warplane' || type === 'missile';
  const orbitSize = usesLargeOrbit ? Math.max(coveragePixelRadius * 2, 30) : Math.max(radius * 2.25, 24);
  const size = usesLargeOrbit ? orbitSize + Math.max(radius * 2.1, 22) : Math.max(radius * 2.25, 24);
  const centerSize = Math.max(size * 0.72, 18);
  const badgeSize = usesLargeOrbit ? Math.max(radius * 2.25, 24) : centerSize;
  const symbolSize = Math.max(centerSize * 0.72, 14);
  const symbolClass = type === 'drone' || type === 'warplane' || type === 'missile'
    ? 'event-marker__symbol event-marker__symbol--orbiting'
    : 'event-marker__symbol';
  const html = `
    <div class="event-marker event-marker--${type} ${isFresh ? 'event-marker--fresh' : ''}" style="--event-color:${color};--event-opacity:${opacity};width:${size}px;height:${size}px;">
      <div class="event-marker__radius" style="width:${badgeSize * 1.72}px;height:${badgeSize * 1.72}px;"></div>
      ${type === 'airstrike' || type === 'warning' ? '<div class="event-marker__shockwave"></div><div class="event-marker__shockwave event-marker__shockwave--late"></div>' : ''}
      <div class="event-marker__orbit" style="width:${orbitSize}px;height:${orbitSize}px;">
        <svg class="${symbolClass}" width="${Math.max(badgeSize * 0.72, 14)}" height="${Math.max(badgeSize * 0.72, 14)}" viewBox="0 0 32 32" aria-hidden="true">
          ${getEventMarkerSymbol(type)}
        </svg>
      </div>
      <div class="event-marker__core" style="width:${badgeSize}px;height:${badgeSize}px;">
        ${count > 1 ? `<span>${count}</span>` : `
          <svg class="event-marker__core-symbol" width="${Math.max(badgeSize * 0.62, 13)}" height="${Math.max(badgeSize * 0.62, 13)}" viewBox="0 0 32 32" aria-hidden="true">
            ${getEventMarkerSymbol(type)}
          </svg>
        `}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker custom-leaflet-marker--event',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const customIcon = (type, color, opacity, count, zIndexBase, isFresh, coveragePixelRadius) => {
  if (type in TYPE_STYLES) {
    return eventIcon(type, color, opacity, count, zIndexBase, isFresh, coveragePixelRadius);
  }

  const html = `
    <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
       ${isFresh ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid ${color};animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
       <div style="width:100%;height:100%;border-radius:50%;background-color:${color};opacity:${opacity};box-shadow: 0 0 10px ${color}"></div>
       ${count > 1 ? `<span style="position:absolute;color:white;font-size:10px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${count}</span>` : ''}
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [zIndexBase * 2, zIndexBase * 2],
    iconAnchor: [zIndexBase, zIndexBase],
  });
};

function MapEvents({ events, focusedEvent, locale, onZoomChange }) {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState(map.getZoom());

  useEffect(() => {
    const onZoomEnd = () => {
      const z = map.getZoom();
      setZoomLevel(z);
      onZoomChange?.(z);
    };
    map.on('zoomend', onZoomEnd);
    return () => map.off('zoomend', onZoomEnd);
  }, [map, onZoomChange]);

  const mapData = useMemo(() => {
    const validEvents = events.filter((e) => e.lat && e.lng && isInLebanon(e.lng, e.lat));
    return clusterEvents(validEvents, locale, zoomLevel);
  }, [events, locale, zoomLevel]);

  // Handle focused event jump
  useEffect(() => {
    if (focusedEvent && focusedEvent.lat && focusedEvent.lng && isInLebanon(focusedEvent.lng, focusedEvent.lat)) {
      map.flyTo([focusedEvent.lat, focusedEvent.lng], FOCUSED_ZOOM, { animate: true, duration: 1.5 });
    }
  }, [focusedEvent, map]);

  return (
    <>
      {mapData.map((incident) => {
        const style = getMarkerStyle(incident.type, incident.timestamp);
        const radius = getMarkerRadius(incident.severity, incident.count, zoomLevel);
        const coverageRadiusMeters = getCoverageRadiusMeters(incident.type, incident.severity, incident.count);
        const coveragePixelRadius = getCoverageRadiusPixels(map, incident.lat, incident.lng, coverageRadiusMeters);
        const isFresh = getAgeBucket(incident.timestamp) === 'fresh';

        return (
          <React.Fragment key={incident.id}>
            <Circle
              center={[incident.lat, incident.lng]}
              radius={coverageRadiusMeters}
              pathOptions={{
                color: style.base,
                fillColor: style.base,
                fillOpacity: Math.min(style.fillOpacity * 0.42, 0.16),
                opacity: Math.min(style.ringOpacity * 0.72, 0.82),
                weight: isFresh ? 2 : 1,
              }}
              eventHandlers={{
                click: () => zoomToCoverageArea(map, incident.lat, incident.lng, coverageRadiusMeters),
              }}
            >
              <Popup className="custom-leaflet-popup" closeButton={false}>
                <IncidentPopup incident={incident} locale={locale} />
              </Popup>
            </Circle>
            <Marker
              position={[incident.lat, incident.lng]}
              icon={customIcon(
                incident.type,
                style.base,
                style.fillOpacity + 0.3,
                incident.count,
                radius,
                isFresh,
                coveragePixelRadius
              )}
              eventHandlers={{
                click: () => zoomToCoverageArea(map, incident.lat, incident.lng, coverageRadiusMeters),
              }}
            >
              <Popup className="custom-leaflet-popup" closeButton={false}>
                <IncidentPopup incident={incident} locale={locale} />
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
}

function MapPanes() {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane('labelPane')) {
      const pane = map.createPane('labelPane');
      pane.style.zIndex = 450;
      pane.style.pointerEvents = 'none';
    }
  }, [map]);

  return null;
}

export default function MapComponent({
  events = [],
  focusedEvent = null,
  locale = 'ar',
  activeType = 'all',
  activeWindow = '24h',
}) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const mapRef = React.useRef(null);
  
  const handleZoomChange = (newZoom) => {
    if (mapRef.current) {
      mapRef.current.setZoom(newZoom);
    }
  };

  const t = MAP_TRANSLATIONS[locale] ?? MAP_TRANSLATIONS.en;
  const isAr = locale === 'ar';

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const limitMap = {
      '30m': 30,
      '1h': 60,
      '2h': 120,
      '3h': 180,
      '6h': 360,
      '12h': 720,
      '24h': 1440,
      all: Infinity,
    };
    const cutoffMinutes = limitMap[activeWindow] ?? 1440;

    return events.filter((e) => {
      const typeMatch = activeType === 'all' || e.type === activeType;
      const ageMinutes = (now - new Date(e.timestamp).getTime()) / 60000;
      const windowMatch = ageMinutes <= cutoffMinutes;
      return typeMatch && windowMatch;
    });
  }, [events, activeType, activeWindow]);

  return (
    <div className="relative flex-1 w-full bg-[#0a0a0a] overflow-hidden min-h-[400px]">
      {/* Map Container */}
      <div className="absolute inset-0 leaflet-dark-wrapper" dir="ltr">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          zoomControl={false}
          className="h-full w-full"
          style={{ height: '100%', width: '100%' }}
          minZoom={7}
          maxZoom={18}
          ref={mapRef}
        >
          <MapPanes />
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            maxZoom={18}
            subdomains="abcd"
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          />
          <MapEvents 
            events={filteredEvents} 
            focusedEvent={focusedEvent} 
            locale={locale} 
            onZoomChange={setZoom}
          />
          <TileLayer
            attribution=""
            maxZoom={18}
            pane="labelPane"
            subdomains="abcd"
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          />
        </MapContainer>
      </div>

      {/* Zoom Slider Overlay */}
      <div className="absolute bottom-6 right-3 z-[400] flex flex-col items-center gap-1.5 rounded-full border border-white/10 bg-black/70 p-1.5 shadow-2xl backdrop-blur-xl sm:bottom-8 sm:right-8">
        <button
          onClick={() => handleZoomChange(Math.min(zoom + 1, 18))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <Slider.Root
          className="relative flex h-20 w-7 cursor-pointer touch-none select-none flex-col items-center sm:h-24"
          value={[zoom]}
          max={18}
          min={7}
          step={0.1}
          orientation="vertical"
          onValueChange={([val]) => handleZoomChange(val)}
        >
          <Slider.Track className="relative w-0.5 grow rounded-full bg-white/10">
            <Slider.Range className="absolute w-full rounded-full bg-red-500/50" />
          </Slider.Track>
          <Slider.Thumb
            className="block h-3.5 w-3.5 rounded-full border-2 border-red-500 bg-white shadow-lg transition-transform hover:scale-110 focus:outline-none"
            aria-label="Zoom"
          />
        </Slider.Root>

        <button
          onClick={() => handleZoomChange(Math.max(zoom - 1, 7))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Overlays / Legend */}
      <div
        className={`pointer-events-none absolute bottom-4 z-[400] sm:bottom-8 ${
          isAr ? 'left-4 sm:left-8' : 'right-4 sm:right-8'
        }`}
        dir={t.dir}
      >
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Toggle Button for Mobile */}
          <button
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-xl backdrop-blur-xl transition hover:bg-black/80 sm:hidden"
          >
            {isLegendOpen ? <ChevronDown className="h-5 w-5 text-white" /> : <Info className="h-5 w-5 text-white" />}
          </button>

          {/* Legend Panel */}
          <div className={`${isLegendOpen ? 'flex' : 'hidden'} w-[220px] flex-col rounded-2xl border border-white/10 bg-black/60 p-4 shadow-2xl backdrop-blur-xl sm:flex sm:w-[260px]`}>
            <h3 className="mb-3 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              {t.legend}
              <button 
                className="sm:hidden p-1 opacity-50 hover:opacity-100"
                onClick={() => setIsLegendOpen(false)}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </h3>

            <div className="space-y-3">
              <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-300">{t.fresh}</span>
                <span className="flex h-3 w-3 items-center justify-center rounded-full bg-red-500/80 ring-[3px] ring-red-500/30 ring-offset-0">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-400">{t.recent}</span>
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              </div>
              <div className="flex items-center justify-between text-[0.65rem] font-medium text-slate-500">
                <span>{t.old}</span>
                <span className="h-2 w-2 rounded-full border border-slate-600 bg-slate-800" />
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="space-y-1.5 pt-1">
              {Object.entries(t.typeLegend).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-300">{label}</span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: TYPE_STYLES[key]?.base || TYPE_STYLES.default.base }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

      
      {/* Global styles for leaflet popup adjustments */}
      <style>{`
        .leaflet-dark-wrapper { background: #0a0a0a !important; }
        .leaflet-container { background: #0a0a0a !important; font-family: 'Inter', sans-serif; }
        .leaflet-popup-content-wrapper { 
          background: rgba(15, 15, 15, 0.9) !important; 
          backdrop-filter: blur(12px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 12px !important;
          color: white !important;
          padding: 0 !important;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,1) !important;
        }
        .leaflet-popup-tip { background: rgba(15, 15, 15, 0.9) !important; border-top: 1px solid rgba(255,255,255,0.1); border-left: 1px solid rgba(255,255,255,0.1); }
        .leaflet-popup-content { margin: 10px 14px !important; }
        .leaflet-control-attribution { background: rgba(0,0,0,0.5) !important; color: #666 !important; bottom: 5px !important; left: 10px !important; right: auto !important; position: absolute !important;}
        .leaflet-control-attribution a { color: #888 !important; }
        .custom-leaflet-marker--event {
          overflow: visible !important;
        }
        .event-marker {
          position: relative;
          display: grid;
          place-items: center;
          pointer-events: auto;
        }
        .event-marker__radius {
          position: absolute;
          left: 50%;
          top: 50%;
          border: 1px solid color-mix(in srgb, var(--event-color) 70%, transparent);
          border-radius: 9999px;
          background:
            radial-gradient(circle, color-mix(in srgb, var(--event-color) 24%, transparent) 0 36%, transparent 37%),
            color-mix(in srgb, var(--event-color) 12%, transparent);
          box-shadow:
            inset 0 0 14px color-mix(in srgb, var(--event-color) 24%, transparent),
            0 0 14px color-mix(in srgb, var(--event-color) 38%, transparent);
          opacity: 0.95;
          transform: translate(-50%, -50%);
        }
        .event-marker__radius::after {
          content: '';
          position: absolute;
          inset: 22%;
          border: 1px solid color-mix(in srgb, var(--event-color) 42%, transparent);
          border-radius: inherit;
        }
        .event-marker__shockwave {
          position: absolute;
          inset: 18%;
          border: 1px solid color-mix(in srgb, var(--event-color) 86%, transparent);
          border-radius: 9999px;
          animation: airstrikeShockwave 1.8s ease-out infinite;
        }
        .event-marker__shockwave--late {
          animation-delay: 0.9s;
        }
        .event-marker__orbit {
          position: absolute;
          display: grid;
          place-items: start center;
          border-radius: 9999px;
          animation: eventMarkerOrbit 13s linear infinite;
          transform-origin: center;
        }
        .event-marker__symbol {
          fill: #fff7ed;
          filter:
            drop-shadow(0 1px 1px rgba(0, 0, 0, 0.95))
            drop-shadow(0 0 5px color-mix(in srgb, var(--event-color) 92%, transparent));
          transform: translateY(-50%);
          transform-origin: center;
        }
        .event-marker__symbol--orbiting {
          transform: translateY(-50%) rotate(90deg);
        }
        .event-marker--drone .event-marker__symbol--orbiting {
          transform: translateY(-50%);
        }
        .event-marker--explosion .event-marker__orbit,
        .event-marker--artillery .event-marker__orbit,
        .event-marker--carAttack .event-marker__orbit,
        .event-marker--warning .event-marker__orbit,
        .event-marker--airstrike .event-marker__orbit {
          animation: none;
          place-items: center;
        }
        .event-marker--explosion .event-marker__symbol,
        .event-marker--artillery .event-marker__symbol,
        .event-marker--carAttack .event-marker__symbol,
        .event-marker--warning .event-marker__symbol,
        .event-marker--airstrike .event-marker__symbol {
          transform: none;
        }
        .event-marker__symbol-stroke {
          fill: none;
          stroke: #fff7ed;
          stroke-width: 2.4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .event-marker__symbol-cutout {
          fill: color-mix(in srgb, var(--event-color) 35%, rgba(0,0,0,0.94));
        }
        .event-marker__core {
          position: relative;
          display: grid;
          place-items: center;
          border: 2px solid color-mix(in srgb, #fff 26%, var(--event-color));
          border-radius: 9999px;
          background:
            radial-gradient(circle at 35% 28%, rgba(255,255,255,0.2), transparent 0 30%),
            color-mix(in srgb, var(--event-color) 78%, rgba(0,0,0,0.48));
          box-shadow:
            0 0 0 2px rgba(0,0,0,0.55),
            0 0 18px color-mix(in srgb, var(--event-color) 70%, transparent);
          z-index: 2;
        }
        .event-marker__core span {
          color: white;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          text-shadow: 0 1px 2px rgba(0,0,0,0.85);
        }
        .event-marker__core-symbol {
          fill: #fff7ed;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.95));
        }
        .event-marker__core-symbol .event-marker__symbol-stroke {
          stroke: #fff7ed;
          stroke-width: 2.7;
        }
        .event-marker__core-symbol .event-marker__symbol-cutout {
          fill: color-mix(in srgb, var(--event-color) 30%, rgba(0,0,0,0.96));
        }
        .event-marker--fresh .event-marker__core {
          animation: eventMarkerCorePulse 1.8s ease-in-out infinite;
        }
        @keyframes eventMarkerOrbit {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes eventMarkerCorePulse {
          0%, 100% {
            box-shadow: 0 0 12px color-mix(in srgb, var(--event-color) 48%, transparent);
          }
          50% {
            box-shadow: 0 0 24px color-mix(in srgb, var(--event-color) 78%, transparent);
          }
        }
        @keyframes airstrikeShockwave {
          0% {
            opacity: 0.9;
            transform: scale(0.45);
          }
          100% {
            opacity: 0;
            transform: scale(1.55);
          }
        }
        .event-marker--warning .event-marker__shockwave {
          animation: warningShockwave 1.5s ease-out infinite;
          border-width: 3px;
        }
        @keyframes warningShockwave {
          0% {
            opacity: 1;
            transform: scale(0.2);
            border-color: var(--event-color);
          }
          50% {
            opacity: 0.8;
            border-color: #fff;
          }
          100% {
            opacity: 0;
            transform: scale(2.2);
            border-color: var(--event-color);
          }
        }
      `}</style>
    </div>
  );
}
