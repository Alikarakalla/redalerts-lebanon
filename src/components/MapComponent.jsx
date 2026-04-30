import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Circle, MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Share2, Copy, ExternalLink, Check } from 'lucide-react';
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
const DEFAULT_ZOOM = 9;
const MIN_ZOOM = 8;
const MAX_ZOOM = 18;
const FOCUSED_ZOOM = 11;

const LEBANON_BOUNDS = { minLng: 35.0, maxLng: 36.7, minLat: 33.0, maxLat: 34.8 };
function isInLebanon(lng, lat) {
  return lng >= LEBANON_BOUNDS.minLng && lng <= LEBANON_BOUNDS.maxLng
      && lat >= LEBANON_BOUNDS.minLat && lat <= LEBANON_BOUNDS.maxLat;
}

const PLACE_LABELS_URL = 'https://alert-lb.com/lebanon-places.geojson';
const PLACE_LABEL_STYLES = {
  city: { minZoom: 7, size: 13, weight: 800 },
  town: { minZoom: 9, size: 11, weight: 700 },
  village: { minZoom: 11, size: 10, weight: 600 },
  suburb: { minZoom: 12, size: 9.5, weight: 500 },
  hamlet: { minZoom: 13, size: 9.5, weight: 500 },
};
const PLACE_LABEL_ORDER = ['city', 'town', 'village', 'suburb', 'hamlet'];

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

function getCoverageRadiusMeters(type, scope, radiusKm = null) {
  const explicitRadiusKm = Number(radiusKm);
  if (Number.isFinite(explicitRadiusKm) && explicitRadiusKm > 0) {
    return Math.round(explicitRadiusKm * 1000);
  }

  const scopeRadius = {
    village: 1500,
    multi_village: 3000,
    district: 8000,
    governorate: 20000,
  };

  return scopeRadius[scope] ?? (type === 'warplane' ? 3000 : 1500);
}

function getCoverageRadiusPixels(map, lat, lng, radiusMeters) {
  if (!map) {
    return 32;
  }

  const centerPoint = map.latLngToLayerPoint([lat, lng]);
  const radiusLat = lat + radiusMeters / 111_320;
  const edgePoint = map.latLngToLayerPoint([radiusLat, lng]);

  return Math.max(Math.abs(centerPoint.y - edgePoint.y), 18);
}

function zoomToCoverageArea(map, lat, lng, radiusMeters) {
  if (!map) return;
  const latOffset = radiusMeters / 111_320;
  const lngOffset = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bounds = L.latLngBounds(
    [lat - latOffset, lng - lngOffset],
    [lat + latOffset, lng + lngOffset]
  );
  map.flyToBounds(bounds, {
    animate: true,
    duration: 1.0,
    padding: [32, 32],
  });
}

function clusterEvents(events, locale) {
  return events
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((event) => ({
      id: event.id,
      kind: 'event',
      type: event.type,
      lat: event.lat,
      lng: event.lng,
      timestamp: event.timestamp,
      severity: event.severity,
      radiusKm: event.radiusKm ?? event.radius_km,
      scope: event.scope,
      count: 1,
      items: [event],
      primaryLocation: event.locationName,
      allLocations: [event.locationName],
      locationCount: 1,
      originalEvent: event,
      title: MAP_TRANSLATIONS[locale].incidentIn(
        formatEventLabel(event.type, locale),
        event.locationName
      ),
    }));
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
    summary = isAr
      ? `🔴 تحديث ميداني: ${typeLabel} في ${incident.primaryLocation}\n⏰ التوقيت: ${time}`
      : `🔴 Field Update: ${typeLabel} in ${incident.primaryLocation}\n⏰ Time: ${time}`;
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
    } catch (err) { console.error('Failed to copy:', err); }
  };
  const shareText = buildEventSummary(incident, locale);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2">
      <button onClick={handleCopy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 py-1.5 text-[10px] font-medium text-slate-300 transition hover:bg-white/10">
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        <span>{isAr ? 'نسخ' : 'Copy'}</span>
      </button>
      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 py-1.5 text-[10px] font-medium text-emerald-400 transition hover:bg-emerald-500/20">
        <Share2 className="h-3 w-3" />
        <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
      </a>
    </div>
  );
}

function IncidentPopup({ incident, locale }) {
  const isCluster = incident.kind === 'cluster';
  const ageBucket = getAgeBucket(incident.timestamp);
  const timeColor = ageBucket === 'fresh' ? 'text-red-400' : ageBucket === 'recent' ? 'text-slate-300' : 'text-slate-500';
  return (
    <div className={`p-1 pt-2 w-[220px] font-sans ${MAP_TRANSLATIONS[locale].dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={MAP_TRANSLATIONS[locale].dir}>
      <h4 className="mb-1 text-[0.85rem] font-bold text-slate-100 flex items-center justify-between border-b border-white/10 pb-1">
        <span>{incident.primaryLocation}</span>
        {isCluster && <span className="text-[0.65rem] bg-white/10 px-1.5 py-0.5 rounded-full">{incident.count}</span>}
      </h4>
      {isCluster && (
        <div className="my-2 space-y-1">
          <p className="text-[0.65rem] text-slate-500 uppercase tracking-wider">{locale === 'ar' ? 'القرى المتأثرة:' : 'Affected villages:'}</p>
          <div className="cluster-location-list flex flex-wrap gap-1">
            {incident.allLocations.map((loc, idx) => (
              <span key={idx} className="text-[0.7rem] text-slate-200 bg-white/5 px-2 py-0.5 rounded border border-white/5">{loc}</span>
            ))}
          </div>
        </div>
      )}
      <p className="mb-1 text-[0.7rem] font-medium text-slate-400">{formatEventLabel(incident.type, locale)}</p>
      <div className={`text-[0.65rem] font-medium ${timeColor}`}>{formatPopupTime(incident.timestamp, locale)}</div>
      <ShareButton incident={incident} locale={locale} />
    </div>
  );
}

function getEventMarkerSymbol(type) {
  if (type === 'drone') {
    return `
      <g transform="scale(0.0625)">
        <ellipse cx="256" cy="256" rx="18" ry="140" fill="currentColor" />
        <circle cx="256" cy="108" r="22" fill="currentColor" />
        <path d="M256 220 L90 260 L95 272 L256 248 L417 272 L422 260 Z" fill="currentColor" />
        <path d="M256 380 L210 420 L215 430 L256 395 L297 430 L302 420 Z" fill="currentColor" />
        <rect x="250" y="380" width="12" height="40" rx="3" fill="currentColor" />
      </g>
    `;
  }
  if (type === 'warplane') {
    return `
      <g transform="scale(0.0625) rotate(-45, 256, 256)">
        <path d="M461.5 31.85c-5 1.2-10.4 3.4-16.4 6.4-12 6-26.7 15.3-42.1 26.1-26.7 18.7-55.5 41.75-75 59.95l39.8 19.9 19.9 39.8c18.2-19.5 41.2-48.3 59.9-75 10.8-15.35 20.1-30.05 26.2-42.15 3-6 5.2-11.3 6.3-16.3 1.2-5 1.9-10.9-2.9-15.7-4.8-4.56-10-4.25-15.7-3zm-14.8 33.4c4.9 4.71 5.6 12.1 3.8 18.7-1.8 6.6-6.1 13.3-12.9 20.15l-42.2 42.2-29.6-29.7L408 74.45c6.8-6.8 13.5-11.06 20.1-12.9 6.1-1.71 14.3-.44 18.6 3.7zM183.2 109.5l-21.3 21.2 45.6 5v-26.2zm129.9 25.2l-43.5 21.8-153 200.1 13.7 13.8 97.5-97.5 11.3 11.3c-32.5 32.5-65 65.1-97.5 97.6l13.8 13.6 200.1-153 21.8-43.5-21.4-42.8zm-256.59.4l7.4 22.2 120.99 83.5 64.5-84.3zm38.1 62.8l-13.1 13.2 24.39 24.3 17.6-17.5zm260.89 64.7l-84.3 64.5 83.5 121 22.2 7.3zm-190.9 4.8l-110.99 9.1-22.6 22.6 82.39 35.4zm212.1 41.2l4.6 41.5 17.1-17.2v-24.3zm-132.1 38.8l-67 51.2 35.3 82.4 22.6-22.6zm-138.7 21.2l-13.09 13.1 37.49 37.4 13.1-13zm188.2 19.9l-17.5 17.6 24.3 24.3 13.2-13.1z" fill="currentColor" />
      </g>
    `;
  }
  if (type === 'missile') return `
    <path d="M18.5 3.5c4.1 2.2 6.3 6.9 5.2 11.4l-7.9 7.9-6.6-6.6 7.9-7.9c.4-1.7.8-3.3 1.4-4.8Z" />
    <path d="M9.4 16.3 5.2 18l3.1 3.1M15.7 22.6 14 26.8l-3.1-3.1" />
    <path class="event-marker__symbol-stroke" d="M8.4 23.6 5.4 26.6M11.1 25.5 8.9 29" />
  `;
  if (type === 'carAttack') return `
    <path d="M7.2 12.7 9.5 7.8h13l2.3 4.9 2.4 1.7v8.5h-3.5v-2.4H8.3v2.4H4.8v-8.5l2.4-1.7Z" />
    <path class="event-marker__symbol-cutout" d="M10.5 10.2h11l1.1 2.6H9.4l1.1-2.6Z" />
    <circle class="event-marker__symbol-cutout" cx="10.2" cy="17.4" r="1.9" />
    <circle class="event-marker__symbol-cutout" cx="21.8" cy="17.4" r="1.9" />
  `;
  if (type === 'artillery') return `
    <path d="M8.3 19.9 23.8 8.8l2.1 3L10.4 22.9Z" />
    <path d="M6.7 20.5h9.5v3.7H6.7Z" />
    <circle cx="9.2" cy="25" r="3.1" />
    <circle cx="19.8" cy="25" r="3.1" />
  `;
  if (type === 'airstrike') return `
    <path d="m16 2.8 2.1 8.2 6.8-5-2.9 7.9 8.2.9-7.5 3.8 5.8 6.2-8.2-2-1.9 8.2-4.2-7.3-7.2 4.4 3.1-7.8-8.3-1.1 7.5-3.7-5.7-6.3 8.1 2L16 2.8Z" />
    <circle class="event-marker__symbol-cutout" cx="16" cy="16" r="3.1" />
    <circle cx="16" cy="16" r="1.4" />
  `;
  if (type === 'explosion') return `
    <path d="m16 3.2 2.7 7.1 6.9-3.1-3.1 6.9 7.1 2.7-7.1 2.7 3.1 6.9-6.9-3.1-2.7 7.1-2.7-7.1-6.9 3.1 3.1-6.9-7.1-2.7 7.1-2.7-3.1-6.9 6.9 3.1L16 3.2Z" />
    <circle class="event-marker__symbol-cutout" cx="16" cy="16" r="3.3" />
  `;
  if (type === 'warning') return `
    <path d="M16 3L2 29h28L16 3z" fill="none" stroke="#fff7ed" stroke-width="2.5" />
    <path d="M16 11v8" stroke="#fff7ed" stroke-width="3" stroke-linecap="round" />
    <circle cx="16" cy="24" r="2" fill="#fff7ed" />
  `;
  return '<circle cx="16" cy="16" r="9" /><path class="event-marker__symbol-cutout" d="M15 8h2v10h-2zM15 21h2v3h-2z" />';
}

const eventIcon = (type, color, opacity, count, radius, isFresh, zoomLevel, coveragePixelRadius = 32) => {
  const isZoomedOut = zoomLevel < 11;

  if (type === 'drone') {
    const size = 64;
    const html = `
      <div class="event-marker event-marker--drone-uav ${isZoomedOut ? 'event-marker--zoomed-out' : ''}" style="--event-color:${color};width:${size}px;height:${size}px;">
        <div class="event-marker__uav-shell">
          <div class="uav-drone-marker">
            <svg viewBox="0 0 512 512" width="22" height="22" fill="${color}" aria-hidden="true">
              <g>
                <ellipse cx="256" cy="256" rx="18" ry="140"></ellipse>
                <circle cx="256" cy="108" r="22"></circle>
                <path d="M256 220 L90 260 L95 272 L256 248 L417 272 L422 260 Z"></path>
                <path d="M256 380 L210 420 L215 430 L256 395 L297 430 L302 420 Z"></path>
                <rect x="250" y="380" width="12" height="40" rx="3"></rect>
              </g>
            </svg>
          </div>
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-leaflet-marker custom-leaflet-marker--event',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  if (type === 'warplane') {
    const safeRadius = Math.max(coveragePixelRadius - 10, 16);
    const wingOffset = Math.min(Math.max(safeRadius * 0.42, 10), 16);
    const planeHalf = 8;
    const usableVertical = Math.sqrt(Math.max(0, safeRadius * safeRadius - wingOffset * wingOffset));
    const travel = Math.max(8, Math.min(usableVertical - planeHalf, 110));
    const width = Math.max(34, Math.min(wingOffset * 2 + 28, 60));
    const height = Math.max(52, Math.min(travel * 2 + 34, 200));
    const leadLeft = Math.round(width / 2 - 8);
    const wingLeft = Math.round(leadLeft - wingOffset);
    const wingRight = Math.round(leadLeft + wingOffset);
    const leadTop = Math.round(height / 2 - 8);
    const wingTop = Math.round(height / 2 + Math.min(Math.max(safeRadius * 0.18, 8), 14));
    const html = `
      <div class="event-marker event-marker--warplane-squad" style="--event-color:${color};--squad-travel:${travel}px;width:${width}px;height:${height}px;">
        <div class="event-marker__squad-shell">
          <div class="event-marker__squad event-marker__squad--lead" style="left:${leadLeft}px;top:${leadTop}px;">
            <svg viewBox="0 0 512 512" width="16" height="16" fill="${color}" aria-hidden="true">
              <path d="M461.5 31.85c-5 1.2-10.4 3.4-16.4 6.4-12 6-26.7 15.3-42.1 26.1-26.7 18.7-55.5 41.75-75 59.95l39.8 19.9 19.9 39.8c18.2-19.5 41.2-48.3 59.9-75 10.8-15.35 20.1-30.05 26.2-42.15 3-6 5.2-11.3 6.3-16.3 1.2-5 1.9-10.9-2.9-15.7-4.8-4.56-10-4.25-15.7-3zm-14.8 33.4c4.9 4.71 5.6 12.1 3.8 18.7-1.8 6.6-6.1 13.3-12.9 20.15l-42.2 42.2-29.6-29.7L408 74.45c6.8-6.8 13.5-11.06 20.1-12.9 6.1-1.71 14.3-.44 18.6 3.7zM183.2 109.5l-21.3 21.2 45.6 5v-26.2zm129.9 25.2l-43.5 21.8-153 200.1 13.7 13.8 97.5-97.5 11.3 11.3c-32.5 32.5-65 65.1-97.5 97.6l13.8 13.6 200.1-153 21.8-43.5-21.4-42.8zm-256.59.4l7.4 22.2 120.99 83.5 64.5-84.3zm38.1 62.8l-13.1 13.2 24.39 24.3 17.6-17.5zm260.89 64.7l-84.3 64.5 83.5 121 22.2 7.3zm-190.9 4.8l-110.99 9.1-22.6 22.6 82.39 35.4zm212.1 41.2l4.6 41.5 17.1-17.2v-24.3zm-132.1 38.8l-67 51.2 35.3 82.4 22.6-22.6zm-138.7 21.2l-13.09 13.1 37.49 37.4 13.1-13zm188.2 19.9l-17.5 17.6 24.3 24.3 13.2-13.1z"></path>
            </svg>
          </div>
          <div class="event-marker__squad event-marker__squad--left" style="left:${wingLeft}px;top:${wingTop}px;">
            <svg viewBox="0 0 512 512" width="14" height="14" fill="${color}" aria-hidden="true">
              <path d="M461.5 31.85c-5 1.2-10.4 3.4-16.4 6.4-12 6-26.7 15.3-42.1 26.1-26.7 18.7-55.5 41.75-75 59.95l39.8 19.9 19.9 39.8c18.2-19.5 41.2-48.3 59.9-75 10.8-15.35 20.1-30.05 26.2-42.15 3-6 5.2-11.3 6.3-16.3 1.2-5 1.9-10.9-2.9-15.7-4.8-4.56-10-4.25-15.7-3zm-14.8 33.4c4.9 4.71 5.6 12.1 3.8 18.7-1.8 6.6-6.1 13.3-12.9 20.15l-42.2 42.2-29.6-29.7L408 74.45c6.8-6.8 13.5-11.06 20.1-12.9 6.1-1.71 14.3-.44 18.6 3.7zM183.2 109.5l-21.3 21.2 45.6 5v-26.2zm129.9 25.2l-43.5 21.8-153 200.1 13.7 13.8 97.5-97.5 11.3 11.3c-32.5 32.5-65 65.1-97.5 97.6l13.8 13.6 200.1-153 21.8-43.5-21.4-42.8zm-256.59.4l7.4 22.2 120.99 83.5 64.5-84.3zm38.1 62.8l-13.1 13.2 24.39 24.3 17.6-17.5zm260.89 64.7l-84.3 64.5 83.5 121 22.2 7.3zm-190.9 4.8l-110.99 9.1-22.6 22.6 82.39 35.4zm212.1 41.2l4.6 41.5 17.1-17.2v-24.3zm-132.1 38.8l-67 51.2 35.3 82.4 22.6-22.6zm-138.7 21.2l-13.09 13.1 37.49 37.4 13.1-13zm188.2 19.9l-17.5 17.6 24.3 24.3 13.2-13.1z"></path>
            </svg>
          </div>
          <div class="event-marker__squad event-marker__squad--right" style="left:${wingRight}px;top:${wingTop}px;">
            <svg viewBox="0 0 512 512" width="14" height="14" fill="${color}" aria-hidden="true">
              <path d="M461.5 31.85c-5 1.2-10.4 3.4-16.4 6.4-12 6-26.7 15.3-42.1 26.1-26.7 18.7-55.5 41.75-75 59.95l39.8 19.9 19.9 39.8c18.2-19.5 41.2-48.3 59.9-75 10.8-15.35 20.1-30.05 26.2-42.15 3-6 5.2-11.3 6.3-16.3 1.2-5 1.9-10.9-2.9-15.7-4.8-4.56-10-4.25-15.7-3zm-14.8 33.4c4.9 4.71 5.6 12.1 3.8 18.7-1.8 6.6-6.1 13.3-12.9 20.15l-42.2 42.2-29.6-29.7L408 74.45c6.8-6.8 13.5-11.06 20.1-12.9 6.1-1.71 14.3-.44 18.6 3.7zM183.2 109.5l-21.3 21.2 45.6 5v-26.2zm129.9 25.2l-43.5 21.8-153 200.1 13.7 13.8 97.5-97.5 11.3 11.3c-32.5 32.5-65 65.1-97.5 97.6l13.8 13.6 200.1-153 21.8-43.5-21.4-42.8zm-256.59.4l7.4 22.2 120.99 83.5 64.5-84.3zm38.1 62.8l-13.1 13.2 24.39 24.3 17.6-17.5zm260.89 64.7l-84.3 64.5 83.5 121 22.2 7.3zm-190.9 4.8l-110.99 9.1-22.6 22.6 82.39 35.4zm212.1 41.2l4.6 41.5 17.1-17.2v-24.3zm-132.1 38.8l-67 51.2 35.3 82.4 22.6-22.6zm-138.7 21.2l-13.09 13.1 37.49 37.4 13.1-13zm188.2 19.9l-17.5 17.6 24.3 24.3 13.2-13.1z"></path>
            </svg>
          </div>
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-leaflet-marker custom-leaflet-marker--event',
      iconSize: [width, height],
      iconAnchor: [width / 2, height / 2],
    });
  }

  const size = 36;
  const iconSizeByType = {
    carAttack: 18,
    explosion: 18,
    warning: 18,
    airstrike: 18,
    artillery: 18,
    missile: 18,
    default: 18,
  };
  const iconSize = iconSizeByType[type] ?? iconSizeByType.default;
  const html = `
    <div class="event-marker event-marker--symbol-badge event-marker--${type} ${isFresh ? 'event-marker--fresh' : ''} ${isZoomedOut ? 'event-marker--zoomed-out' : ''}" style="--event-color:${color};width:${size}px;height:${size}px;">
      <div class="event-marker__symbol-shell">
        <div class="event-marker__symbol-badge-core">
          ${count > 1 ? `<span class="event-marker__symbol-count">${count}</span>` : `
            <svg class="event-marker__symbol-badge-icon" width="${iconSize}" height="${iconSize}" viewBox="0 0 32 32" aria-hidden="true">
              ${getEventMarkerSymbol(type)}
            </svg>
          `}
        </div>
        ${(type === 'airstrike' || type === 'warning' || type === 'explosion') && !isZoomedOut ? '<div class="event-marker__symbol-pulse"></div>' : ''}
      </div>
    </div>
  `;
  return L.divIcon({ html, className: 'custom-leaflet-marker custom-leaflet-marker--event', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
};

const customIcon = (type, color, opacity, count, radius, isFresh, zoomLevel, coveragePixelRadius) => {
  if (type in TYPE_STYLES) return eventIcon(type, color, opacity, count, radius, isFresh, zoomLevel, coveragePixelRadius);
  const html = `
    <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
       ${isFresh ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid ${color};animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
       <div style="width:100%;height:100%;border-radius:50%;background-color:${color};opacity:${opacity};box-shadow: 0 0 8px ${color}88"></div>
       ${count > 1 ? `<span style="position:absolute;color:white;font-size:10px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${count}</span>` : ''}
    </div>
  `;
  return L.divIcon({ html, className: 'custom-leaflet-marker', iconSize: [24, 24], iconAnchor: [12, 12] });
};

const MapMarker = React.memo(({ incident, locale, zoomLevel, map }) => {
  const ageBucket = getAgeBucket(incident.timestamp);
  const style = getMarkerStyle(incident.type, incident.timestamp);
  const radius = getMarkerRadius(incident.severity, incident.count, zoomLevel);
  const coverageRadiusMeters = getCoverageRadiusMeters(incident.type, incident.scope, incident.radiusKm);
  const isFresh = ageBucket === 'fresh';
  const displayCoverageRadiusMeters = coverageRadiusMeters;
  const coveragePixelRadius = getCoverageRadiusPixels(map, incident.lat, incident.lng, displayCoverageRadiusMeters);
  const icon = useMemo(() => customIcon(incident.type, style.base, style.fillOpacity + 0.3, incident.count, radius, isFresh, zoomLevel, coveragePixelRadius), 
    [incident.type, style.base, style.fillOpacity, incident.count, radius, isFresh, zoomLevel, coveragePixelRadius]);
  const handleClick = useCallback(() => zoomToCoverageArea(map, incident.lat, incident.lng, coverageRadiusMeters), 
    [map, incident.lat, incident.lng, coverageRadiusMeters]);
  const showCoverage = true;
  const isWarplane = incident.type === 'warplane';
  const coveragePathOptions = {
    color: style.base,
    fillColor: style.base,
    fillOpacity: isWarplane ? 0 : 0.08,
    opacity: isWarplane ? 0.5 : 0.35,
    weight: isWarplane ? 1 : 1.5,
    dashArray: isWarplane ? '6 8' : undefined,
  };

  return (
    <React.Fragment>
      {showCoverage && (
        <Circle center={[incident.lat, incident.lng]} radius={displayCoverageRadiusMeters} pathOptions={coveragePathOptions} eventHandlers={{ click: handleClick }} />
      )}
      <Marker position={[incident.lat, incident.lng]} icon={icon} eventHandlers={{ click: handleClick }}>
        <Popup className="custom-leaflet-popup" closeButton={false}><IncidentPopup incident={incident} locale={locale} /></Popup>
      </Marker>
    </React.Fragment>
  );
});
function MapEvents({ events, focusedEvent, locale }) {
  const map = useMap();
  const [zoomLevel, setZoomLevel] = useState(map.getZoom());
  useEffect(() => {
    const updateZoomClass = (nextZoom) => {
      const container = map.getContainer();
      if (!container) return;
      container.classList.toggle('zoom-detail', nextZoom >= 11);
    };
    const onZoomEnd = () => {
      const nextZoom = map.getZoom();
      setZoomLevel(nextZoom);
      updateZoomClass(nextZoom);
    };
    updateZoomClass(map.getZoom());
    map.on('zoomend', onZoomEnd);
    return () => {
      const container = map.getContainer();
      if (container) {
        container.classList.remove('zoom-detail');
      }
      map.off('zoomend', onZoomEnd);
    };
  }, [map]);
  const mapData = useMemo(() => {
    const validEvents = events.filter((e) => e.lat && e.lng && isInLebanon(e.lng, e.lat));
    return clusterEvents(validEvents, locale);
  }, [events, locale]);
  useEffect(() => {
    if (focusedEvent && focusedEvent.lat && focusedEvent.lng && isInLebanon(focusedEvent.lng, focusedEvent.lat)) {
      const radiusMeters = getCoverageRadiusMeters(focusedEvent.type, focusedEvent.scope, focusedEvent.radiusKm ?? focusedEvent.radius_km);
      zoomToCoverageArea(map, focusedEvent.lat, focusedEvent.lng, radiusMeters);
    }
  }, [focusedEvent, map]);
  return <>{mapData.map((incident) => <MapMarker key={incident.id} incident={incident} locale={locale} zoomLevel={zoomLevel} map={map} />)}</>;
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

class PlaceLabelsLayer extends L.Layer {
  constructor(features, locale, isDarkMode) {
    super();
    this.features = features;
    this.locale = locale;
    this.isDarkMode = isDarkMode;
    this.frameId = null;
  }

  setOptions(locale, isDarkMode) {
    this.locale = locale;
    this.isDarkMode = isDarkMode;
    this.scheduleDraw();
  }

  onAdd(map) {
    this.map = map;
    this.canvas = L.DomUtil.create('canvas', 'lb-labels-canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.willChange = 'transform';
    (map.getPane('labelPane') || map.getPanes().overlayPane).appendChild(this.canvas);
    map.on('moveend zoomend resize', this.reset, this);
    map.on('zoomstart zoomanim', this.hide, this);
    this.reset();
    return this;
  }

  onRemove(map) {
    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    map.off('moveend zoomend resize', this.reset, this);
    map.off('zoomstart zoomanim', this.hide, this);
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    this.map = null;
    this.canvas = null;
    return this;
  }

  hide() {
    if (this.canvas) {
      this.canvas.style.opacity = '0';
    }
  }

  reset() {
    if (!this.map || !this.canvas) return;
    const size = this.map.getSize();
    const scale = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(size.x * scale);
    this.canvas.height = Math.round(size.y * scale);
    this.canvas.style.width = `${size.x}px`;
    this.canvas.style.height = `${size.y}px`;
    L.DomUtil.setPosition(this.canvas, this.map.containerPointToLayerPoint([0, 0]));
    this.canvas.style.opacity = '1';
    this.scheduleDraw();
  }

  scheduleDraw() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    this.frameId = requestAnimationFrame(() => this.draw());
  }

  draw() {
    if (!this.map || !this.canvas) return;
    const context = this.canvas.getContext('2d');
    if (!context) return;

    const scale = window.devicePixelRatio || 1;
    const zoom = this.map.getZoom();
    const bounds = this.map.getBounds();
    const placed = [];
    const strokeColor = this.isDarkMode ? '#0a0a0a' : '#f8fafc';
    const mainColor = this.isDarkMode ? '#f8fafc' : '#0f172a';
    const mutedColor = this.isDarkMode ? '#a8b1d1' : '#475569';

    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (const placeType of PLACE_LABEL_ORDER) {
      const style = PLACE_LABEL_STYLES[placeType];
      if (!style || zoom < style.minZoom) continue;

      context.font = `${style.weight} ${style.size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      const labelColor = placeType === 'city' || placeType === 'town' ? mainColor : mutedColor;
      const halfHeight = style.size / 2;

      for (const feature of this.features) {
        if (feature?.properties?.p !== placeType) continue;
        const [lng, lat] = feature.geometry?.coordinates || [];
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !bounds.contains([lat, lng])) continue;

        const label = this.locale === 'ar'
          ? feature.properties.na || feature.properties.n || feature.properties.ne
          : feature.properties.ne || feature.properties.n || feature.properties.na;
        if (!label) continue;

        const point = this.map.latLngToContainerPoint([lat, lng]);
        const halfWidth = context.measureText(label).width / 2;
        const box = {
          x1: point.x - halfWidth - 4,
          y1: point.y - halfHeight - 2,
          x2: point.x + halfWidth + 4,
          y2: point.y + halfHeight + 2,
        };
        if (placed.some((item) => box.x1 < item.x2 && box.x2 > item.x1 && box.y1 < item.y2 && box.y2 > item.y1)) {
          continue;
        }

        placed.push(box);
        context.lineWidth = 3;
        context.strokeStyle = strokeColor;
        context.strokeText(label, point.x, point.y);
        context.fillStyle = labelColor;
        context.fillText(label, point.x, point.y);
      }
    }
  }
}

function PlaceLabels({ locale, isDarkMode }) {
  const map = useMap();
  const layerRef = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch(PLACE_LABELS_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Place labels returned ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const features = Array.isArray(payload.features) ? payload.features : [];
        const layer = new PlaceLabelsLayer(features, locale, isDarkMode);
        layer.addTo(map);
        layerRef.current = layer;
      })
      .catch((error) => {
        console.error('Failed to load place labels:', error);
      });

    return () => {
      cancelled = true;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    layerRef.current?.setOptions(locale, isDarkMode);
  }, [locale, isDarkMode]);

  return null;
}

function getMapThemeOverride() {
  if (typeof window === 'undefined') return null;
  const urlTheme = new URLSearchParams(window.location.search).get('mapTheme');
  const theme = urlTheme || window.localStorage?.getItem('mapTheme');
  return theme === 'light' || theme === 'dark' ? theme : null;
}

function useMapDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const override = getMapThemeOverride();
    if (override) return override === 'dark';
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    const override = getMapThemeOverride();
    if (override) { setIsDarkMode(override === 'dark'); return; }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setIsDarkMode(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  return isDarkMode;
}

export default function MapComponent({ events = [], focusedEvent = null, locale = 'ar', activeType = 'all', activeWindow = '24h', replayTime = null, replayStartTime = null }) {
  const isDarkMode = useMapDarkMode();
  const mapRef = React.useRef(null);
  const baseTileUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
  useEffect(() => {
    const handleTimelineZoom = (event) => {
      const delta = Number(event.detail?.delta || 0);
      if (!delta || !mapRef.current) return;
      mapRef.current.setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, mapRef.current.getZoom() + delta)));
    };
    window.addEventListener('redalerts:map-zoom', handleTimelineZoom);
    return () => window.removeEventListener('redalerts:map-zoom', handleTimelineZoom);
  }, []);
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const limitMap = { '30m': 30, '1h': 60, '2h': 120, '3h': 180, '6h': 360, '12h': 720, '24h': 1440, all: Infinity };
    const cutoffMinutes = limitMap[activeWindow] ?? 1440;
    return events.filter((e) => {
      const typeMatch = activeType === 'all' || e.type === activeType;
      const eventTime = new Date(e.timestamp).getTime();
      if (replayTime && replayStartTime) return typeMatch && eventTime >= replayStartTime && eventTime <= replayTime;
      return typeMatch && (now - eventTime) / 60000 <= cutoffMinutes;
    });
  }, [events, activeType, activeWindow, replayTime, replayStartTime]);
  return (
    <div className={`relative flex-1 w-full overflow-hidden min-h-[400px] ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#f8fafc]'}`}>
      <div className={`absolute inset-0 ${isDarkMode ? 'leaflet-dark-wrapper' : 'leaflet-light-wrapper'}`} dir="ltr">
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} zoomControl={false} className="h-full w-full" minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} ref={mapRef}>
          <MapPanes />
          <TileLayer key={`base-${isDarkMode ? 'dark' : 'light'}`} attribution='&copy; CartoDB' url={baseTileUrl} subdomains={['a', 'b', 'c', 'd']} />
          <PlaceLabels locale={locale} isDarkMode={isDarkMode} />
          <MapEvents events={filteredEvents} focusedEvent={focusedEvent} locale={locale} />
        </MapContainer>
      </div>
      <style>{`
        .leaflet-container { background: #1a1a1a !important; }
        .leaflet-popup-content-wrapper { background: rgba(12, 12, 12, 0.95) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; border-radius: 12px !important; color: white !important; padding: 0 !important; max-width: 280px !important; }
        .leaflet-popup-content { margin: 0 !important; width: auto !important; max-height: 300px; overflow-y: auto; }
        .leaflet-popup-tip { background: rgba(15, 15, 15, 0.9) !important; }
        .lb-labels-canvas { z-index: 455; }
        .event-marker { position: relative; display: grid; place-items: center; will-change: transform; }
        .event-marker--drone-uav {
          pointer-events: auto;
        }
        .event-marker__uav-shell {
          position: relative;
          width: 64px;
          height: 64px;
          pointer-events: auto;
        }
        .uav-drone-marker {
          width: 22px;
          height: 22px;
          position: absolute;
          left: 50%;
          top: 50%;
          margin-left: -11px;
          margin-top: -11px;
          transform: translate(0, 0);
          will-change: transform;
        }
        .uav-drone-marker svg {
          display: block;
          filter: drop-shadow(0 0 5px color-mix(in srgb, var(--event-color, #f59e0b) 66%, transparent));
        }
        .event-marker--drone-uav.event-marker--zoomed-out .uav-drone-marker {
          transform: translate(0, 0) scale(1.22);
          transform-origin: center;
        }
        .event-marker--drone-uav.event-marker--zoomed-out .uav-drone-marker svg {
          filter:
            drop-shadow(0 0 8px color-mix(in srgb, var(--event-color, #f59e0b) 78%, transparent))
            drop-shadow(0 0 3px rgba(0, 0, 0, 0.55));
        }
        .leaflet-container.zoom-detail .uav-drone-marker {
          animation: droneOrbit 6s linear infinite;
        }
        .event-marker--symbol-badge {
          pointer-events: auto;
        }
        .event-marker__symbol-shell {
          position: relative;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
        }
        .event-marker__symbol-badge-core {
          position: relative;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 9999px;
          background: color-mix(in srgb, var(--event-color, #fff) 10%, rgba(6, 10, 16, 0.92));
          box-shadow:
            0 0 0 2px color-mix(in srgb, var(--event-color, #fff) 85%, transparent),
            0 0 8px color-mix(in srgb, var(--event-color, #fff) 25%, transparent);
        }
        .event-marker__symbol-badge-icon {
          display: block;
          fill: var(--event-color, #fff);
          color: var(--event-color, #fff);
          filter: drop-shadow(0 0 5px color-mix(in srgb, var(--event-color, #fff) 66%, transparent));
        }
        .event-marker__symbol-count {
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        }
        .event-marker__symbol-pulse {
          position: absolute;
          inset: 6px;
          border: 1px solid color-mix(in srgb, var(--event-color, #fff) 52%, transparent);
          border-radius: 9999px;
          animation: symbolPulse 1.8s ease-out infinite;
        }
        .event-marker--warplane-squad {
          pointer-events: auto;
        }
        .event-marker__squad-shell {
          position: relative;
          width: 60px;
          height: 200px;
          pointer-events: none;
          overflow: hidden;
        }
        .event-marker__squad {
          position: absolute;
          animation: warplaneSquad 7s linear infinite;
          pointer-events: auto;
        }
        .event-marker__squad svg {
          display: block;
          transform: rotate(-45deg);
        }
        .event-marker__squad--lead {
          filter: drop-shadow(0 0 3px color-mix(in srgb, var(--event-color, #3b8eff) 55%, transparent));
        }
        .event-marker__squad--left {
          opacity: 0.85;
          filter: drop-shadow(0 0 2px color-mix(in srgb, var(--event-color, #3b8eff) 55%, transparent));
        }
        .event-marker__squad--right {
          opacity: 0.85;
          filter: drop-shadow(0 0 2px color-mix(in srgb, var(--event-color, #3b8eff) 55%, transparent));
        }
        .cluster-location-list { max-height: 120px; overflow-y: auto; padding-right: 4px; }
        .cluster-location-list::-webkit-scrollbar { width: 4px; }
        .cluster-location-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @keyframes droneOrbit { from { transform: rotate(0deg) translateX(20px); } to { transform: rotate(-360deg) translateX(20px); } }
        @keyframes warplaneSquad { 0% { transform: translateY(var(--squad-travel, 40px)); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(calc(var(--squad-travel, 40px) * -1)); opacity: 0; } }
        @keyframes symbolPulse { 0% { opacity: 0.85; transform: scale(0.55); } 100% { opacity: 0; transform: scale(1.7); } }
        @media (max-width: 768px), (pointer: coarse) {
          .event-marker--drone-uav.event-marker--zoomed-out .uav-drone-marker {
            transform: translate(0, 0) scale(1.34);
          }
          .uav-drone-marker {
            transform: translate(0, 0) scale(1.18);
            transform-origin: center;
          }
          .uav-drone-marker svg {
            width: 24px;
            height: 24px;
            filter:
              drop-shadow(0 0 8px color-mix(in srgb, var(--event-color, #f59e0b) 72%, transparent))
              drop-shadow(0 0 3px rgba(0, 0, 0, 0.55));
          }
          .event-marker__symbol-badge-core {
            width: 36px;
            height: 36px;
            box-shadow:
              0 0 0 1.25px color-mix(in srgb, var(--event-color, #fff) 64%, transparent),
              0 0 16px color-mix(in srgb, var(--event-color, #fff) 34%, transparent);
          }
          .event-marker__symbol-badge-icon {
            width: 18px !important;
            height: 18px !important;
            filter:
              drop-shadow(0 0 8px color-mix(in srgb, var(--event-color, #fff) 72%, transparent))
              drop-shadow(0 0 3px rgba(0, 0, 0, 0.55));
          }
          .event-marker__symbol-count {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
