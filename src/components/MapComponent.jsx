import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Circle, GeoJSON, MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Share2, Copy, ExternalLink, Check } from 'lucide-react';
import L from 'leaflet';
import { feature as topojsonFeature } from 'topojson-client';
import 'leaflet/dist/leaflet.css';
import lebanonLevel2 from '../data/lebanon-level2.json';

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
const LEBANON_VIEW_BOUNDS = [[33.02, 35.05], [34.72, 36.68]];
const LEBANON_LEVEL2_OBJECT = 'gadm36_LBN_2';

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

const eventIcon = (type, color, opacity, count, radius, isFresh, zoomLevel, coveragePixelRadius = 32, mapPreview = 'modern') => {
  const isZoomedOut = zoomLevel < 11;
  const useClassicPreview = mapPreview === 'classic';

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

  if (!useClassicPreview && type === 'airstrike') {
    const size = isZoomedOut ? 14 : 50;
    const html = `
      <div class="event-marker event-marker--airstrike ${isZoomedOut ? 'event-marker--zoomed-out' : ''}" style="--event-color:${color};width:${size}px;height:${size}px;">
        <div class="event-marker__airstrike-shell">
          ${isZoomedOut ? '' : `
            <div class="event-marker__airstrike-shockwave"></div>
            <div class="event-marker__airstrike-shockwave"></div>
            <div class="event-marker__airstrike-shockwave"></div>
            <div class="event-marker__airstrike-base-circle"></div>
            <div class="event-marker__airstrike-target-ring"></div>
          `}
          <div class="event-marker__airstrike-jet">
            <div class="event-marker__airstrike-jet-tail"></div>
            <div class="event-marker__airstrike-jet-wing event-marker__airstrike-jet-wing--left"></div>
            <div class="event-marker__airstrike-jet-wing event-marker__airstrike-jet-wing--right"></div>
            <div class="event-marker__airstrike-jet-body"></div>
          </div>
          ${isZoomedOut ? '' : '<div class="event-marker__airstrike-impact-dot"></div>'}
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

  if (!useClassicPreview && type === 'explosion') {
    const size = isZoomedOut ? 14 : 44;
    const html = `
      <div class="event-marker event-marker--explosion ${isZoomedOut ? 'event-marker--zoomed-out' : ''}" style="--event-color:${color};width:${size}px;height:${size}px;">
        <div class="event-marker__explosion-shell">
          ${isZoomedOut ? '' : `
            <div class="event-marker__explosion-pulse-ring event-marker__explosion-pulse-ring--outer"></div>
            <div class="event-marker__explosion-pulse-ring"></div>
            <div class="event-marker__explosion-circle"></div>
          `}
          <div class="event-marker__explosion-burst">
            <div class="event-marker__explosion-spike event-marker__explosion-spike--1"></div>
            <div class="event-marker__explosion-spike event-marker__explosion-spike--2"></div>
            <div class="event-marker__explosion-spike event-marker__explosion-spike--3"></div>
            <div class="event-marker__explosion-spike event-marker__explosion-spike--4"></div>
            <div class="event-marker__explosion-spike event-marker__explosion-spike--5"></div>
            <div class="event-marker__explosion-spike event-marker__explosion-spike--6"></div>
            <div class="event-marker__explosion-spike event-marker__explosion-spike--7"></div>
            <div class="event-marker__explosion-spike event-marker__explosion-spike--8"></div>
          </div>
          <div class="event-marker__explosion-center-dot"></div>
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

  if (!useClassicPreview && type === 'artillery') {
    const size = isZoomedOut ? 14 : 44;
    const html = `
      <div class="event-marker event-marker--artillery ${isZoomedOut ? 'event-marker--zoomed-out' : ''}" style="--event-color:${color};width:${size}px;height:${size}px;">
        <div class="event-marker__artillery-shell">
          ${isZoomedOut ? '' : `
            <div class="event-marker__artillery-pulse-ring event-marker__artillery-pulse-ring--outer"></div>
            <div class="event-marker__artillery-pulse-ring"></div>
            <div class="event-marker__artillery-circle"></div>
            <div class="event-marker__artillery-crosshair"></div>
          `}
          <div class="event-marker__artillery-cannon">
            <div class="event-marker__artillery-barrel"></div>
            <div class="event-marker__artillery-base"></div>
            <div class="event-marker__artillery-wheel event-marker__artillery-wheel--left"></div>
            <div class="event-marker__artillery-wheel event-marker__artillery-wheel--right"></div>
          </div>
          ${isZoomedOut ? '' : '<div class="event-marker__artillery-flash"></div>'}
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

  if (!useClassicPreview && type === 'carAttack') {
    const size = isZoomedOut ? 14 : 56;
    const html = `
      <div class="event-marker event-marker--car-attack ${isZoomedOut ? 'event-marker--zoomed-out' : ''}" style="--event-color:${color};width:${size}px;height:${size}px;">
        <div class="event-marker__car-attack-shell">
          ${isZoomedOut ? '' : `
            <div class="event-marker__car-attack-wave"></div>
            <div class="event-marker__car-attack-wave"></div>
            <div class="event-marker__car-attack-base-circle"></div>
            <div class="event-marker__car-attack-smoke event-marker__car-attack-smoke--1"></div>
            <div class="event-marker__car-attack-smoke event-marker__car-attack-smoke--2"></div>
            <div class="event-marker__car-attack-smoke event-marker__car-attack-smoke--3"></div>
          `}
          <div class="event-marker__car-attack-flames">
            <div class="event-marker__car-attack-flame event-marker__car-attack-flame--1"></div>
            <div class="event-marker__car-attack-flame event-marker__car-attack-flame--2"></div>
            <div class="event-marker__car-attack-flame event-marker__car-attack-flame--3"></div>
            <div class="event-marker__car-attack-flame event-marker__car-attack-flame--4"></div>
          </div>
          <div class="event-marker__car-attack-flame-core"></div>
          <div class="event-marker__car-attack-car-group">
            <div class="event-marker__car-attack-car-roof"></div>
            <div class="event-marker__car-attack-car-window"></div>
            <div class="event-marker__car-attack-car-body"></div>
            <div class="event-marker__car-attack-car-wheel event-marker__car-attack-car-wheel--left"></div>
            <div class="event-marker__car-attack-car-wheel event-marker__car-attack-car-wheel--right"></div>
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

  const size = 36;
  const iconSizeByType = {
    warning: 18,
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

const customIcon = (type, color, opacity, count, radius, isFresh, zoomLevel, coveragePixelRadius, mapPreview) => {
  if (type in TYPE_STYLES) return eventIcon(type, color, opacity, count, radius, isFresh, zoomLevel, coveragePixelRadius, mapPreview);
  const html = `
    <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
       ${isFresh ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid ${color};animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
       <div style="width:100%;height:100%;border-radius:50%;background-color:${color};opacity:${opacity};box-shadow: 0 0 8px ${color}88"></div>
       ${count > 1 ? `<span style="position:absolute;color:white;font-size:10px;font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${count}</span>` : ''}
    </div>
  `;
  return L.divIcon({ html, className: 'custom-leaflet-marker', iconSize: [24, 24], iconAnchor: [12, 12] });
};

const MapMarker = React.memo(({ incident, locale, zoomLevel, map, mapPreview }) => {
  const ageBucket = getAgeBucket(incident.timestamp);
  const style = getMarkerStyle(incident.type, incident.timestamp);
  const radius = getMarkerRadius(incident.severity, incident.count, zoomLevel);
  const coverageRadiusMeters = getCoverageRadiusMeters(incident.type, incident.scope, incident.radiusKm);
  const isFresh = ageBucket === 'fresh';
  const displayCoverageRadiusMeters = coverageRadiusMeters;
  const coveragePixelRadius = getCoverageRadiusPixels(map, incident.lat, incident.lng, displayCoverageRadiusMeters);
  const icon = useMemo(() => customIcon(incident.type, style.base, style.fillOpacity + 0.3, incident.count, radius, isFresh, zoomLevel, coveragePixelRadius, mapPreview), 
    [incident.type, style.base, style.fillOpacity, incident.count, radius, isFresh, zoomLevel, coveragePixelRadius, mapPreview]);
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
function MapEvents({ events, focusedEvent, locale, mapPreview }) {
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
  return <>{mapData.map((incident) => <MapMarker key={incident.id} incident={incident} locale={locale} zoomLevel={zoomLevel} map={map} mapPreview={mapPreview} />)}</>;
}

function MapPanes() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane('countryFillPane')) {
      const pane = map.createPane('countryFillPane');
      pane.style.zIndex = 240;
      pane.style.pointerEvents = 'none';
    }
    if (!map.getPane('countryBoundaryPane')) {
      const pane = map.createPane('countryBoundaryPane');
      pane.style.zIndex = 430;
      pane.style.pointerEvents = 'none';
    }
    if (!map.getPane('labelPane')) {
      const pane = map.createPane('labelPane');
      pane.style.zIndex = 450;
      pane.style.pointerEvents = 'none';
    }
  }, [map]);
  return null;
}

function InitialLebanonView({ enabled, focusedEvent }) {
  const map = useMap();
  const hasInitializedRef = React.useRef(false);

  useEffect(() => {
    if (!enabled || focusedEvent || hasInitializedRef.current) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const width = window.innerWidth || map.getSize().x || 0;
      const isMobile = width <= 768;
      map.fitBounds(LEBANON_VIEW_BOUNDS, {
        animate: false,
        paddingTopLeft: isMobile ? [10, 14] : [28, 28],
        paddingBottomRight: isMobile ? [10, 54] : [28, 28],
      });
      hasInitializedRef.current = true;
    });

    return () => cancelAnimationFrame(frameId);
  }, [enabled, focusedEvent, map]);

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

function getMapModeOverride() {
  if (typeof window === 'undefined') return 'lebanon';
  const urlMode = new URLSearchParams(window.location.search).get('mapMode');
  const storedMode = window.localStorage?.getItem('mapMode');
  const mode = urlMode || storedMode;
  return mode === 'tiles' || mode === 'default' ? 'tiles' : 'lebanon';
}

function getLebanonDistrictGeoJson() {
  const object = lebanonLevel2?.objects?.[LEBANON_LEVEL2_OBJECT];
  if (!object) return { type: 'FeatureCollection', features: [] };
  return topojsonFeature(lebanonLevel2, object);
}

function LebanonOnlyOverlay({ isDarkMode }) {
  const districtGeoJson = useMemo(getLebanonDistrictGeoJson, []);
  if (!districtGeoJson.features?.length) return null;

  return (
    <>
      <GeoJSON
        data={districtGeoJson}
        pane="countryFillPane"
        interactive={false}
        style={{
          color: 'transparent',
          fillColor: isDarkMode ? '#05070b' : '#f8fafc',
          fillOpacity: isDarkMode ? 0.74 : 0.82,
          weight: 0,
        }}
      />
      <GeoJSON
        data={districtGeoJson}
        pane="countryBoundaryPane"
        interactive={false}
        style={{
          color: isDarkMode ? 'rgba(248, 250, 252, 0.28)' : 'rgba(15, 23, 42, 0.28)',
          fillColor: 'transparent',
          fillOpacity: 0,
          weight: 1.15,
        }}
      />
    </>
  );
}

export default function MapComponent({ events = [], focusedEvent = null, locale = 'ar', activeType = 'all', activeWindow = '24h', mapPreview = 'modern', replayTime = null, replayStartTime = null }) {
  const isDarkMode = useMapDarkMode();
  const isLebanonOnlyMode = getMapModeOverride() === 'lebanon';
  const mapRef = React.useRef(null);
  const surfaceRef = React.useRef(null);
  const baseTileUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
  useEffect(() => {
    if (!isLebanonOnlyMode) return undefined;

    const surface = surfaceRef.current;
    if (!surface) return undefined;

    let frameId = 0;
    const updatePointerGlow = (event) => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        surface.style.setProperty('--cursor-x', `${event.clientX}px`);
        surface.style.setProperty('--cursor-y', `${event.clientY}px`);
        surface.style.setProperty('--cursor-opacity', '1');
      });
    };
    const hidePointerGlow = () => {
      surface.style.setProperty('--cursor-opacity', '0');
    };

    window.addEventListener('pointermove', updatePointerGlow, { passive: true });
    window.addEventListener('pointerleave', hidePointerGlow);
    window.addEventListener('blur', hidePointerGlow);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('pointermove', updatePointerGlow);
      window.removeEventListener('pointerleave', hidePointerGlow);
      window.removeEventListener('blur', hidePointerGlow);
    };
  }, [isLebanonOnlyMode]);
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
    <div ref={surfaceRef} className={`relative flex-1 w-full overflow-hidden min-h-[400px] ${isLebanonOnlyMode ? 'lebanon-only-surface' : isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#f8fafc]'}`}>
      <div className={`absolute inset-0 ${isDarkMode ? 'leaflet-dark-wrapper' : 'leaflet-light-wrapper'}`} dir="ltr">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          zoomControl={false}
          className={`h-full w-full ${isLebanonOnlyMode ? 'lebanon-only-map' : ''}`}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          ref={mapRef}
        >
          <MapPanes />
          <InitialLebanonView enabled={isLebanonOnlyMode} focusedEvent={focusedEvent} />
          {isLebanonOnlyMode ? null : (
            <TileLayer key={`base-${isDarkMode ? 'dark' : 'light'}`} attribution='&copy; CartoDB' url={baseTileUrl} subdomains={['a', 'b', 'c', 'd']} />
          )}
          {isLebanonOnlyMode ? <LebanonOnlyOverlay isDarkMode={isDarkMode} /> : null}
          <PlaceLabels locale={locale} isDarkMode={isDarkMode} />
          <MapEvents events={filteredEvents} focusedEvent={focusedEvent} locale={locale} mapPreview={mapPreview} />
        </MapContainer>
      </div>
      <style>{`
        .leaflet-container { background: #1a1a1a !important; }
        .lebanon-only-surface {
          --cursor-x: 50vw;
          --cursor-y: 50vh;
          --cursor-opacity: 0;
          isolation: isolate;
          background:
            radial-gradient(circle at 9% 92%, rgba(43, 72, 150, 0.18), transparent 0 18%),
            radial-gradient(circle at 8% 96%, rgba(23, 42, 96, 0.12), transparent 0 12%),
            radial-gradient(circle, rgba(255, 255, 255, 0.08) 0.8px, transparent 0.9px),
            linear-gradient(180deg, rgba(20, 20, 20, 0.995), rgba(18, 18, 18, 1)),
            #121212;
          background-size: auto, auto, 11px 11px, auto;
          background-attachment: fixed;
        }
        .lebanon-only-surface::before,
        .lebanon-only-surface::after {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .lebanon-only-surface::before {
          background:
            radial-gradient(circle at 9% 92%, rgba(47, 86, 170, 0.1), transparent 0 17%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.012), transparent 14%);
        }
        .lebanon-only-surface::after {
          opacity: var(--cursor-opacity);
          background: radial-gradient(circle, rgba(255, 255, 255, 0.65) 1px, transparent 1.1px);
          background-size: 11px 11px;
          background-attachment: fixed;
          -webkit-mask-image: radial-gradient(
            80px circle at var(--cursor-x) var(--cursor-y),
            black 0%,
            transparent 100%
          );
          mask-image: radial-gradient(
            80px circle at var(--cursor-x) var(--cursor-y),
            black 0%,
            transparent 100%
          );
          transition: opacity 160ms ease;
        }
        .lebanon-only-surface > .leaflet-dark-wrapper,
        .lebanon-only-surface > .leaflet-light-wrapper {
          z-index: 1;
        }
        .lebanon-only-map.leaflet-container {
          background: transparent !important;
        }
        @media (pointer: coarse) {
          .lebanon-only-surface::after {
            display: block;
            opacity: 1 !important;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.5) 1px, transparent 1.1px);
            background-size: 11px 11px;
            background-attachment: fixed;
            -webkit-mask-image: linear-gradient(135deg, transparent 42%, black 50%, transparent 58%);
            mask-image: linear-gradient(135deg, transparent 42%, black 50%, transparent 58%);
            -webkit-mask-size: 300% 300%;
            mask-size: 300% 300%;
            -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
            animation: sweepLine 6s infinite linear;
          }
        }
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
        .event-marker--airstrike {
          pointer-events: auto;
        }
        .event-marker--explosion {
          pointer-events: auto;
        }
        .event-marker--artillery {
          pointer-events: auto;
        }
        .event-marker--car-attack {
          pointer-events: auto;
        }
        .event-marker__airstrike-shell {
          position: relative;
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
        }
        .event-marker--airstrike.event-marker--zoomed-out .event-marker__airstrike-shell {
          width: 14px;
          height: 14px;
          transform: none;
          transform-origin: center;
        }
        .event-marker--airstrike.event-marker--zoomed-out .event-marker__airstrike-jet {
          width: 10px;
          height: 10px;
          animation: none;
          filter: drop-shadow(0 0 4px color-mix(in srgb, var(--event-color, #d42b2b) 60%, transparent));
        }
        .event-marker--airstrike.event-marker--zoomed-out .event-marker__airstrike-jet-body {
          width: 5px;
          height: 8px;
        }
        .event-marker--airstrike.event-marker--zoomed-out .event-marker__airstrike-jet-wing {
          width: 7px;
          height: 3px;
        }
        .event-marker--airstrike.event-marker--zoomed-out .event-marker__airstrike-jet-wing--left {
          top: 2px;
          left: -3px;
        }
        .event-marker--airstrike.event-marker--zoomed-out .event-marker__airstrike-jet-wing--right {
          top: 2px;
          right: -3px;
        }
        .event-marker--airstrike.event-marker--zoomed-out .event-marker__airstrike-jet-tail {
          width: 3px;
          height: 2px;
          top: 0;
        }
        .event-marker__airstrike-shockwave {
          position: absolute;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 2px solid color-mix(in srgb, var(--event-color, #d42b2b) 50%, transparent);
          animation: airstrikeShockwave 2s ease-out infinite;
        }
        .event-marker__airstrike-shockwave:nth-child(2) {
          animation-delay: 0.55s;
        }
        .event-marker__airstrike-shockwave:nth-child(3) {
          animation-delay: 1.1s;
        }
        .event-marker__airstrike-base-circle {
          position: absolute;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 2.5px solid var(--event-color, #d42b2b);
          background: color-mix(in srgb, var(--event-color, #d42b2b) 12%, transparent);
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--event-color, #d42b2b) 20%, transparent),
            0 0 12px color-mix(in srgb, var(--event-color, #d42b2b) 22%, transparent);
        }
        .event-marker__airstrike-target-ring {
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1.5px solid color-mix(in srgb, var(--event-color, #d42b2b) 60%, transparent);
          animation: airstrikeTargetBlink 1.6s ease-in-out infinite;
        }
        .event-marker__airstrike-jet {
          position: relative;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--event-color, #d42b2b);
          animation: airstrikeJetDive 1.6s ease-in-out infinite;
        }
        .event-marker__airstrike-jet-body {
          position: absolute;
          width: 10px;
          height: 16px;
          background: currentColor;
          clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
          filter: drop-shadow(0 0 3px color-mix(in srgb, var(--event-color, #d42b2b) 55%, transparent));
        }
        .event-marker__airstrike-jet-wing {
          position: absolute;
          width: 14px;
          height: 5px;
          background: currentColor;
        }
        .event-marker__airstrike-jet-wing--left {
          clip-path: polygon(100% 0%, 0% 100%, 100% 100%);
          top: 4px;
          left: -6px;
        }
        .event-marker__airstrike-jet-wing--right {
          clip-path: polygon(0% 0%, 100% 100%, 0% 100%);
          top: 4px;
          right: -6px;
        }
        .event-marker__airstrike-jet-tail {
          position: absolute;
          width: 6px;
          height: 4px;
          top: 0;
          background: currentColor;
          clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
          transform: scaleY(-1);
        }
        .event-marker__airstrike-impact-dot {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          bottom: 6px;
          background: var(--event-color, #d42b2b);
          box-shadow: 0 0 8px 3px color-mix(in srgb, var(--event-color, #d42b2b) 70%, transparent);
          animation: airstrikeImpactFlash 1.6s ease-in-out infinite;
        }
        .event-marker__explosion-shell {
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
        }
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-shell {
          width: 14px;
          height: 14px;
        }
        .event-marker__explosion-pulse-ring {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          border: 2px solid color-mix(in srgb, var(--event-color, #e8502a) 40%, transparent);
          animation: explosionPulseRing 1.8s ease-out infinite;
        }
        .event-marker__explosion-pulse-ring--outer {
          inset: -18px;
          border-color: color-mix(in srgb, var(--event-color, #e8502a) 20%, transparent);
          animation-delay: 0.6s;
        }
        .event-marker__explosion-circle {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2.5px solid var(--event-color, #e8502a);
          background: color-mix(in srgb, var(--event-color, #e8502a) 15%, transparent);
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--event-color, #e8502a) 18%, transparent),
            0 0 12px color-mix(in srgb, var(--event-color, #e8502a) 22%, transparent);
        }
        .event-marker__explosion-burst {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .event-marker__explosion-spike {
          position: absolute;
          width: 2.5px;
          left: 50%;
          top: 50%;
          background: var(--event-color, #e8502a);
          border-radius: 2px;
          transform-origin: bottom center;
          animation: explosionSpikeFlicker 1.8s ease-in-out infinite;
          filter: drop-shadow(0 0 4px color-mix(in srgb, var(--event-color, #e8502a) 40%, transparent));
        }
        .event-marker__explosion-spike--1 { height: 14px; transform: translateX(-50%) translateY(-100%) rotate(0deg); animation-delay: 0s; }
        .event-marker__explosion-spike--2 { height: 11px; transform: translateX(-50%) translateY(-100%) rotate(45deg); animation-delay: 0.1s; }
        .event-marker__explosion-spike--3 { height: 14px; transform: translateX(-50%) translateY(-100%) rotate(90deg); animation-delay: 0.2s; }
        .event-marker__explosion-spike--4 { height: 11px; transform: translateX(-50%) translateY(-100%) rotate(135deg); animation-delay: 0.3s; }
        .event-marker__explosion-spike--5 { height: 14px; transform: translateX(-50%) translateY(-100%) rotate(180deg); animation-delay: 0.4s; }
        .event-marker__explosion-spike--6 { height: 11px; transform: translateX(-50%) translateY(-100%) rotate(225deg); animation-delay: 0.5s; }
        .event-marker__explosion-spike--7 { height: 14px; transform: translateX(-50%) translateY(-100%) rotate(270deg); animation-delay: 0.6s; }
        .event-marker__explosion-spike--8 { height: 11px; transform: translateX(-50%) translateY(-100%) rotate(315deg); animation-delay: 0.7s; }
        .event-marker__explosion-center-dot {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--event-color, #e8502a);
          box-shadow: 0 0 6px 2px color-mix(in srgb, var(--event-color, #e8502a) 60%, transparent);
          animation: explosionDotGlow 1.8s ease-in-out infinite alternate;
        }
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike {
          width: 1.5px;
          animation: none;
          filter: drop-shadow(0 0 3px color-mix(in srgb, var(--event-color, #e8502a) 44%, transparent));
        }
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike--1,
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike--3,
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike--5,
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike--7 {
          height: 7px;
        }
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike--2,
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike--4,
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike--6,
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-spike--8 {
          height: 5px;
        }
        .event-marker--explosion.event-marker--zoomed-out .event-marker__explosion-center-dot {
          width: 4px;
          height: 4px;
          animation: none;
          box-shadow: 0 0 4px 1px color-mix(in srgb, var(--event-color, #e8502a) 70%, transparent);
        }
        .event-marker__artillery-shell {
          position: relative;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
        }
        .event-marker--artillery.event-marker--zoomed-out .event-marker__artillery-shell {
          width: 14px;
          height: 14px;
        }
        .event-marker__artillery-pulse-ring {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          border: 1.8px solid color-mix(in srgb, var(--event-color, #fb7185) 40%, transparent);
          animation: artilleryPulseRing 1.9s ease-out infinite;
        }
        .event-marker__artillery-pulse-ring--outer {
          inset: -16px;
          border-color: color-mix(in srgb, var(--event-color, #fb7185) 20%, transparent);
          animation-delay: 0.55s;
        }
        .event-marker__artillery-circle {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2.5px solid var(--event-color, #fb7185);
          background: color-mix(in srgb, var(--event-color, #fb7185) 14%, transparent);
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--event-color, #fb7185) 18%, transparent),
            0 0 12px color-mix(in srgb, var(--event-color, #fb7185) 22%, transparent);
        }
        .event-marker__artillery-crosshair {
          position: absolute;
          inset: 8px;
        }
        .event-marker__artillery-crosshair::before,
        .event-marker__artillery-crosshair::after {
          content: '';
          position: absolute;
          background: color-mix(in srgb, var(--event-color, #fb7185) 75%, transparent);
          opacity: 0.85;
        }
        .event-marker__artillery-crosshair::before {
          width: 1.5px;
          height: 100%;
          left: 50%;
          transform: translateX(-50%);
        }
        .event-marker__artillery-crosshair::after {
          height: 1.5px;
          width: 100%;
          top: 50%;
          transform: translateY(-50%);
        }
        .event-marker__artillery-cannon {
          position: relative;
          width: 22px;
          height: 22px;
          transform: rotate(-28deg);
          animation: artilleryRecoil 1.9s ease-in-out infinite;
        }
        .event-marker__artillery-barrel {
          position: absolute;
          width: 15px;
          height: 3.5px;
          right: 3px;
          top: 5px;
          border-radius: 999px;
          background: var(--event-color, #fb7185);
          box-shadow: 0 0 5px color-mix(in srgb, var(--event-color, #fb7185) 45%, transparent);
        }
        .event-marker__artillery-base {
          position: absolute;
          width: 10px;
          height: 6px;
          left: 6px;
          bottom: 6px;
          border-radius: 3px 3px 2px 2px;
          background: var(--event-color, #fb7185);
        }
        .event-marker__artillery-wheel {
          position: absolute;
          width: 5px;
          height: 5px;
          bottom: 2px;
          border-radius: 50%;
          background: var(--event-color, #fb7185);
          box-shadow: 0 0 4px color-mix(in srgb, var(--event-color, #fb7185) 38%, transparent);
        }
        .event-marker__artillery-wheel--left {
          left: 5px;
        }
        .event-marker__artillery-wheel--right {
          left: 12px;
        }
        .event-marker__artillery-flash {
          position: absolute;
          width: 7px;
          height: 7px;
          right: 7px;
          top: 10px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--event-color, #fb7185) 80%, #ffd166 20%);
          box-shadow: 0 0 8px 3px color-mix(in srgb, var(--event-color, #fb7185) 55%, transparent);
          animation: artilleryFlash 1.9s ease-in-out infinite;
        }
        .event-marker--artillery.event-marker--zoomed-out .event-marker__artillery-cannon {
          width: 10px;
          height: 10px;
          animation: none;
        }
        .event-marker--artillery.event-marker--zoomed-out .event-marker__artillery-barrel {
          width: 7px;
          height: 2px;
          right: 1px;
          top: 2px;
        }
        .event-marker--artillery.event-marker--zoomed-out .event-marker__artillery-base {
          width: 5px;
          height: 3px;
          left: 3px;
          bottom: 3px;
        }
        .event-marker--artillery.event-marker--zoomed-out .event-marker__artillery-wheel {
          width: 2px;
          height: 2px;
          bottom: 1px;
          box-shadow: 0 0 3px color-mix(in srgb, var(--event-color, #fb7185) 35%, transparent);
        }
        .event-marker--artillery.event-marker--zoomed-out .event-marker__artillery-wheel--left {
          left: 2px;
        }
        .event-marker--artillery.event-marker--zoomed-out .event-marker__artillery-wheel--right {
          left: 5px;
        }
        .event-marker__car-attack-shell {
          position: relative;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-shell {
          width: 14px;
          height: 14px;
        }
        .event-marker__car-attack-wave {
          position: absolute;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 2px solid color-mix(in srgb, var(--event-color, #cc3300) 50%, transparent);
          animation: carAttackWave 2s ease-out infinite;
        }
        .event-marker__car-attack-wave:nth-child(2) {
          animation-delay: 0.7s;
        }
        .event-marker__car-attack-base-circle {
          position: absolute;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2.5px solid color-mix(in srgb, var(--event-color, #cc3300) 88%, #ff8c00 12%);
          background: color-mix(in srgb, var(--event-color, #cc3300) 12%, transparent);
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--event-color, #cc3300) 18%, transparent),
            0 0 12px color-mix(in srgb, var(--event-color, #ff8c00) 18%, transparent);
        }
        .event-marker__car-attack-car-group {
          position: relative;
          width: 32px;
          height: 18px;
          margin-top: 6px;
          z-index: 3;
        }
        .event-marker__car-attack-car-body {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 32px;
          height: 10px;
          border-radius: 2px;
          background: #3a1a00;
        }
        .event-marker__car-attack-car-roof {
          position: absolute;
          bottom: 8px;
          left: 8px;
          width: 16px;
          height: 9px;
          border-radius: 4px 4px 1px 1px;
          background: #3a1a00;
        }
        .event-marker__car-attack-car-window {
          position: absolute;
          bottom: 10px;
          left: 10px;
          width: 12px;
          height: 6px;
          border-radius: 2px 2px 0 0;
          background: rgba(255, 120, 0, 0.55);
          box-shadow: 0 0 5px 1px rgba(255, 100, 0, 0.6);
          animation: carAttackWindowGlow 0.5s ease-in-out infinite alternate;
        }
        .event-marker__car-attack-car-wheel {
          position: absolute;
          width: 7px;
          height: 7px;
          bottom: -3px;
          border-radius: 50%;
          background: #1a0a00;
          border: 1.5px solid #3a1a00;
        }
        .event-marker__car-attack-car-wheel--left {
          left: 3px;
        }
        .event-marker__car-attack-car-wheel--right {
          right: 3px;
        }
        .event-marker__car-attack-flames {
          position: absolute;
          bottom: 22px;
          left: 50%;
          transform: translateX(-50%);
          width: 34px;
          height: 24px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 2px;
          z-index: 4;
        }
        .event-marker__car-attack-flame {
          border-radius: 50% 50% 30% 30% / 60% 60% 40% 40%;
          animation: carAttackFlicker 0.4s ease-in-out infinite alternate;
          transform-origin: bottom center;
        }
        .event-marker__car-attack-flame--1 {
          width: 7px;
          height: 16px;
          background: radial-gradient(ellipse at 40% 80%, #fff176, #ff8c00, #cc2200);
          animation-delay: 0s;
        }
        .event-marker__car-attack-flame--2 {
          width: 9px;
          height: 22px;
          margin-bottom: 1px;
          background: radial-gradient(ellipse at 40% 80%, #ffffff, #ffcc00, #ff4400, #991100);
          animation-delay: 0.07s;
        }
        .event-marker__car-attack-flame--3 {
          width: 8px;
          height: 18px;
          background: radial-gradient(ellipse at 40% 80%, #fff176, #ff6600, #bb1100);
          animation-delay: 0.13s;
        }
        .event-marker__car-attack-flame--4 {
          width: 6px;
          height: 13px;
          background: radial-gradient(ellipse at 40% 80%, #ffee58, #ff8800, #cc2200);
          animation-delay: 0.2s;
        }
        .event-marker__car-attack-flame-core {
          position: absolute;
          bottom: 22px;
          left: 50%;
          width: 6px;
          height: 10px;
          transform: translateX(-50%);
          border-radius: 50% 50% 30% 30% / 60% 60% 40% 40%;
          background: radial-gradient(ellipse at 50% 80%, #ffffff, #aaddff, rgba(100,180,255,0));
          animation: carAttackCoreFlicker 0.3s ease-in-out infinite alternate;
          z-index: 5;
        }
        .event-marker__car-attack-smoke {
          position: absolute;
          border-radius: 50%;
          background: rgba(50, 30, 20, 0.45);
          animation: carAttackSmokeRise 1.4s ease-out infinite;
          z-index: 6;
        }
        .event-marker__car-attack-smoke--1 {
          width: 10px;
          height: 10px;
          bottom: 44px;
          left: 18px;
          animation-delay: 0s;
        }
        .event-marker__car-attack-smoke--2 {
          width: 8px;
          height: 8px;
          bottom: 44px;
          left: 26px;
          animation-delay: 0.45s;
        }
        .event-marker__car-attack-smoke--3 {
          width: 7px;
          height: 7px;
          bottom: 44px;
          left: 22px;
          animation-delay: 0.9s;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-car-group {
          width: 10px;
          height: 7px;
          margin-top: 2px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-car-body {
          width: 10px;
          height: 4px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-car-roof {
          width: 5px;
          height: 3px;
          left: 3px;
          bottom: 3px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-car-window {
          width: 4px;
          height: 2px;
          left: 3px;
          bottom: 4px;
          animation: none;
          box-shadow: 0 0 3px 1px rgba(255, 110, 0, 0.55);
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-car-wheel {
          width: 2px;
          height: 2px;
          bottom: -1px;
          border-width: 1px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-car-wheel--left {
          left: 1px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-car-wheel--right {
          right: 1px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-flames {
          width: 10px;
          height: 8px;
          bottom: 6px;
          gap: 1px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-flame {
          animation: none;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-flame--1,
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-flame--4 {
          width: 2px;
          height: 4px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-flame--2 {
          width: 3px;
          height: 6px;
          margin-bottom: 0;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-flame--3 {
          width: 2px;
          height: 5px;
        }
        .event-marker--car-attack.event-marker--zoomed-out .event-marker__car-attack-flame-core {
          width: 2px;
          height: 4px;
          bottom: 6px;
          animation: none;
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
        @keyframes airstrikeShockwave { 0% { transform: scale(0.6); opacity: 0.9; } 80% { transform: scale(2.2); opacity: 0; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes airstrikeJetDive { 0% { transform: translateY(-4px); } 50% { transform: translateY(2px); } 100% { transform: translateY(-4px); } }
        @keyframes airstrikeTargetBlink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.3); } }
        @keyframes airstrikeImpactFlash { 0%, 100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes explosionPulseRing { 0% { transform: scale(1); opacity: 0.8; } 60% { transform: scale(1.4); opacity: 0.2; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes explosionSpikeFlicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes explosionDotGlow { from { box-shadow: 0 0 4px 1px color-mix(in srgb, var(--event-color, #e8502a) 50%, transparent); } to { box-shadow: 0 0 10px 4px color-mix(in srgb, var(--event-color, #ff8a2a) 80%, transparent); } }
        @keyframes artilleryPulseRing { 0% { transform: scale(1); opacity: 0.75; } 60% { transform: scale(1.38); opacity: 0.2; } 100% { transform: scale(1.55); opacity: 0; } }
        @keyframes artilleryRecoil { 0%, 100% { transform: rotate(-28deg) translateX(0); } 18% { transform: rotate(-28deg) translateX(-1px); } 35% { transform: rotate(-28deg) translateX(1px); } }
        @keyframes artilleryFlash { 0%, 100% { opacity: 0; transform: scale(0.45); } 18% { opacity: 1; transform: scale(1.2); } 35% { opacity: 0.2; transform: scale(0.8); } }
        @keyframes carAttackWave { 0% { transform: scale(0.7); opacity: 0.9; } 80% { transform: scale(2.2); opacity: 0; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes carAttackFlicker { 0% { transform: scaleX(1) scaleY(1) skewX(0deg); } 33% { transform: scaleX(0.85) scaleY(1.1) skewX(-4deg); } 66% { transform: scaleX(1.1) scaleY(0.92) skewX(3deg); } 100% { transform: scaleX(0.9) scaleY(1.08) skewX(-2deg); } }
        @keyframes carAttackCoreFlicker { from { opacity: 0.8; transform: translateX(-50%) scaleY(1); } to { opacity: 1; transform: translateX(-50%) scaleY(1.2); } }
        @keyframes carAttackWindowGlow { from { background: rgba(255,100,0,0.45); box-shadow: 0 0 4px 1px rgba(255,80,0,0.5); } to { background: rgba(255,160,20,0.75); box-shadow: 0 0 8px 2px rgba(255,120,0,0.8); } }
        @keyframes carAttackSmokeRise { 0% { transform: translateY(0) scale(0.6); opacity: 0.5; } 60% { transform: translateY(-14px) scale(1.4); opacity: 0.3; } 100% { transform: translateY(-22px) scale(1.8); opacity: 0; } }
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
