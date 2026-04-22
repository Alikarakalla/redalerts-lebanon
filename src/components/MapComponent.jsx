import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Info, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
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

function getMarkerRadius(severity, count = 1, zIndex) {
  const base = severity === 'high' ? 12 : severity === 'medium' ? 9 : 7;
  if (count <= 1) return base;
  return Math.min(base + Math.log2(count + 1) * 3, 20);
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

function clusterEvents(events, locale, zoomLevel) {
  const sorted = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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

  return clusters.map((cluster) => {
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
    </div>
  );
}

const customIcon = (color, opacity, count, zIndexBase, isFresh) => {
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
        const radius = getMarkerRadius(incident.severity, incident.count);
        const isFresh = getAgeBucket(incident.timestamp) === 'fresh';

        return (
          <Marker
            key={incident.id}
            position={[incident.lat, incident.lng]}
            icon={customIcon(style.base, style.fillOpacity + 0.3, incident.count, radius, isFresh)}
          >
            <Popup className="custom-leaflet-popup" closeButton={false}>
              <IncidentPopup incident={incident} locale={locale} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
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
    const limitMap = { '30m': 30, '2h': 120, '24h': 1440, all: Infinity };
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
          maxZoom={14}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <MapEvents 
            events={filteredEvents} 
            focusedEvent={focusedEvent} 
            locale={locale} 
            onZoomChange={setZoom}
          />
        </MapContainer>
      </div>

      {/* Zoom Slider Overlay */}
      <div className="absolute bottom-4 right-4 z-[400] flex flex-col items-center gap-3 rounded-full border border-white/10 bg-black/60 p-2 py-4 shadow-2xl backdrop-blur-xl sm:bottom-8 sm:right-8">
        <button
          onClick={() => handleZoomChange(Math.min(zoom + 1, 14))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>

        <Slider.Root
          className="relative flex h-32 w-8 cursor-pointer touch-none select-none flex-col items-center"
          value={[zoom]}
          max={14}
          min={7}
          step={0.1}
          orientation="vertical"
          onValueChange={([val]) => handleZoomChange(val)}
        >
          <Slider.Track className="relative w-1 grow rounded-full bg-white/10">
            <Slider.Range className="absolute w-full rounded-full bg-red-500/50" />
          </Slider.Track>
          <Slider.Thumb
            className="block h-4 w-4 rounded-full border-2 border-red-500 bg-white shadow-lg transition-transform hover:scale-110 focus:outline-none"
            aria-label="Zoom"
          />
        </Slider.Root>

        <button
          onClick={() => handleZoomChange(Math.max(zoom - 1, 7))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-4 w-4" />
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
      `}</style>
    </div>
  );
}
