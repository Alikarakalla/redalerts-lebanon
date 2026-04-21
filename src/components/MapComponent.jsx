import React, { useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import lebanonGeo from '../data/lebanon-level2.json';

const MAP_TRANSLATIONS = {
  en: {
    dir: 'ltr',
    eventLabels: {
      explosion: 'Explosion',
      artillery: 'Artillery',
      airstrike: 'Airstrike',
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
      strike: 'Strike / Explosion',
    },
  },
  ar: {
    dir: 'rtl',
    eventLabels: {
      explosion: '\u0627\u0646\u0641\u062c\u0627\u0631',
      artillery: '\u0642\u0635\u0641 \u0645\u062f\u0641\u0639\u064a',
      airstrike: '\u063a\u0627\u0631\u0629',
      warplane: '\u0645\u0642\u0627\u062a\u0644\u0627\u062a \u062d\u0631\u0628\u064a\u0629',
      missile: '\u0635\u0627\u0631\u0648\u062e',
      drone: '\u0645\u0633\u064a\u0631\u0629',
      default: '\u062d\u0627\u062f\u062b',
    },
    legend: '\u0627\u0644\u062f\u0644\u064a\u0644',
    fresh: '\u062d\u062f\u062b \u062c\u062f\u064a\u062f \u062e\u0644\u0627\u0644 \u0623\u0642\u0644 \u0645\u0646 30 \u062f\u0642\u064a\u0642\u0629',
    recent: '\u062d\u062f\u062b \u062d\u062f\u064a\u062b \u062e\u0644\u0627\u0644 \u0623\u0642\u0644 \u0645\u0646 \u0633\u0627\u0639\u062a\u064a\u0646',
    old: '\u0623\u0642\u062f\u0645 \u0645\u0646 \u0633\u0627\u0639\u062a\u064a\u0646',
    incidents: '\u062a\u0646\u0628\u064a\u0647\u0627\u062a',
    incidentIn: (label, location) => `${label} \u0641\u064a ${location}`,
    clusterSummary: (count, label, location) => `${count} \u062a\u0646\u0628\u064a\u0647\u0627\u062a ${label} \u0642\u0631\u0628 ${location}`,
    typeLegend: {
      drone: '\u0645\u0633\u064a\u0631\u0629',
      warplane: '\u0645\u0642\u0627\u062a\u0644\u0627\u062a \u062d\u0631\u0628\u064a\u0629',
      strike: '\u063a\u0627\u0631\u0629 / \u0627\u0646\u0641\u062c\u0627\u0631',
    },
  },
};

const DEFAULT_CENTER = [35.76, 33.9];
const DEFAULT_ZOOM = 1.6;
const MOBILE_DEFAULT_ZOOM = 2;
const FOCUSED_ZOOM = 2.65;
const MOBILE_FOCUSED_ZOOM = 2.4;
const CLUSTER_RADIUS_KM = 11;

const PLACE_LABELS = [
  { key: 'tripoli', coordinates: [35.8442, 34.4367], en: 'Tripoli', ar: '\u0637\u0631\u0627\u0628\u0644\u0633' },
  { key: 'beirut', coordinates: [35.5018, 33.8938], en: 'Beirut', ar: '\u0628\u064a\u0631\u0648\u062a' },
  { key: 'jounieh', coordinates: [35.6178, 33.9808], en: 'Jounieh', ar: '\u062c\u0648\u0646\u064a\u0629' },
  { key: 'zahle', coordinates: [35.8961, 33.8467], en: 'Zahle', ar: '\u0632\u062d\u0644\u0629' },
  { key: 'sidon', coordinates: [35.3681, 33.5575], en: 'Sidon', ar: '\u0635\u064a\u062f\u0627' },
  { key: 'tyre', coordinates: [35.1939, 33.2704], en: 'Tyre', ar: '\u0635\u0648\u0631' },
  { key: 'nabatieh', coordinates: [35.4836, 33.3789], en: 'Nabatieh', ar: '\u0627\u0644\u0646\u0628\u0637\u064a\u0629' },
  { key: 'baalbek', coordinates: [36.2181, 34.0061], en: 'Baalbek', ar: '\u0628\u0639\u0644\u0628\u0643' },
];

const MOBILE_LABEL_KEYS = new Set(['tripoli', 'beirut', 'sidon', 'tyre', 'nabatieh', 'zahle', 'baalbek']);

const TYPE_STYLES = {
  drone: { base: '#f59e0b' },
  warplane: { base: '#38bdf8' },
  airstrike: { base: '#ef4444' },
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

function getMarkerRadius(severity, count = 1) {
  const base = severity === 'high' ? 16 : severity === 'medium' ? 12 : 9;
  if (count <= 1) return base;
  return Math.min(base + Math.log2(count + 1) * 4, 28);
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

function clusterEvents(events, locale) {
  const sorted = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const clusters = [];

  for (const event of sorted) {
    const existing = clusters.find(
      (cluster) => cluster.type === event.type && distanceKm(cluster, event) <= CLUSTER_RADIUS_KM
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
      locations: [...cluster.locationNames],
      locationName: primaryLocation,
      description:
        cluster.count > 1
          ? MAP_TRANSLATIONS[locale].clusterSummary(
            cluster.count,
            formatEventLabel(cluster.type, locale),
            primaryLocation
          )
          : latestItem.description,
      radius: getMarkerRadius(cluster.severity, cluster.count),
      isNew: getEventAgeMinutes(cluster.timestamp) <= 30,
      style: getMarkerStyle(cluster.type, cluster.timestamp),
    };
  });
}

function LegendOverlay({ locale, isMobile }) {
  const t = MAP_TRANSLATIONS[locale];
  const [isOpen, setIsOpen] = useState(!isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  return (
    <div
      className={`pointer-events-auto absolute bottom-3 left-1/2 z-20 w-[min(calc(100vw-2rem),18rem)] -translate-x-1/2 rounded-[1.5rem] border border-white/10 bg-black/40 backdrop-blur-md transition-all duration-300 sm:bottom-6 sm:left-4 sm:translate-x-0 sm:w-60 ${isOpen ? 'p-3 sm:p-4' : 'p-2.5 px-4 sm:p-3'}`}
      dir={t.dir}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between outline-none"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300 sm:text-xs sm:tracking-[0.24em]">
          {t.legend}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 fill-none stroke-slate-400 stroke-2 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-3 sm:mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 text-[10px] text-slate-300 sm:text-xs pb-1">
            <div className="grid grid-cols-1 gap-1.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ff4d5a]" />
                <span>{t.fresh}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#d7263d]" />
                <span>{t.recent}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#5b0f18]" />
                <span>{t.old}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                <span>{t.typeLegend.drone}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#38bdf8]" />
                <span>{t.typeLegend.warplane}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
                <span>{t.typeLegend.strike}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapComponent({ events, focusedEvent, locale = 'ar', activeType = 'all', activeWindow = '24h' }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [manualView, setManualView] = useState(null);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const syncMobile = () => setIsMobile(mediaQuery.matches);
    syncMobile();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', syncMobile);
      return () => mediaQuery.removeEventListener('change', syncMobile);
    }

    mediaQuery.addListener(syncMobile);
    return () => mediaQuery.removeListener(syncMobile);
  }, []);

  useEffect(() => {
    if (!focusedEvent) return;
    setManualView(null);
    setSelectedEvent({
      ...focusedEvent,
      kind: 'event',
      count: 1,
      locations: [focusedEvent.locationName],
      style: getMarkerStyle(focusedEvent.type, focusedEvent.timestamp),
    });
  }, [focusedEvent]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const cutoffMinutes = activeWindow === '30m' ? 30 : activeWindow === '2h' ? 120 : 24 * 60;

    return events.filter((event) => {
      const ageMinutes = (now - new Date(event.timestamp).getTime()) / 60000;
      return ageMinutes <= cutoffMinutes && (activeType === 'all' || event.type === activeType);
    });
  }, [activeType, activeWindow, events]);

  const renderedItems = useMemo(() => clusterEvents(filteredEvents, locale), [filteredEvents, locale]);
  const placeLabels = useMemo(
    () =>
      PLACE_LABELS.filter((place) => !isMobile || MOBILE_LABEL_KEYS.has(place.key)).map((place) => ({
        ...place,
        label: locale === 'ar' ? place.ar : place.en,
      })),
    [isMobile, locale]
  );

  const mobileViewCenter = [35.76, 33.8];
  const autoViewCenter = focusedEvent ? [focusedEvent.lng, focusedEvent.lat] : (isMobile ? mobileViewCenter : DEFAULT_CENTER);
  const autoViewZoom = focusedEvent
    ? isMobile
      ? MOBILE_FOCUSED_ZOOM
      : FOCUSED_ZOOM
    : isMobile
      ? MOBILE_DEFAULT_ZOOM
      : DEFAULT_ZOOM;

  const currentCenter = manualView ? manualView.center : autoViewCenter;
  const currentZoom = manualView ? manualView.zoom : autoViewZoom;

  const t = MAP_TRANSLATIONS[locale];

  return (
    <div className="relative h-[calc(100vh-11rem)] min-h-[620px] overflow-hidden sm:h-[calc(100vh-10rem)] sm:min-h-[680px]">
      
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-2.5 rounded-full border-b border-r border-white/5 border-l border-t border-white/20 bg-white/5 p-2 py-3 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:bottom-12 sm:right-6">
        <button 
          type="button" 
          onClick={() => setManualView({ center: currentCenter, zoom: Math.min(currentZoom + 0.3, 5) })}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white active:scale-95 sm:h-8 sm:w-8"
          aria-label="Zoom in"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current stroke-2 fill-none sm:w-4 sm:h-4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.05"
          value={currentZoom}
          onChange={(e) => setManualView({ center: currentCenter, zoom: parseFloat(e.target.value) })}
          className="h-28 w-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-red-500 hover:accent-red-400 sm:h-36"
          style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
          title="Zoom"
        />

        <button 
          type="button" 
          onClick={() => setManualView({ center: currentCenter, zoom: Math.max(currentZoom - 0.3, 0.5) })}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-slate-300 transition hover:bg-white/20 hover:text-white active:scale-95 sm:h-8 sm:w-8"
          aria-label="Zoom out"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current stroke-2 fill-none sm:w-4 sm:h-4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
        </button>
      </div>

      <div className="lebanon-map-shell absolute left-1/2 top-1/2 h-[min(82vh,760px)] w-[min(100vw,620px)] -translate-x-1/2 -translate-y-1/2 sm:h-[min(84vh,860px)] sm:w-[min(64vw,760px)] lg:h-[min(88vh,920px)] lg:w-[min(52vw,720px)]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: DEFAULT_CENTER, scale: isMobile ? 12500 : 12500 }}
          className="map-stage h-full w-full overflow-visible"
        >
          <ZoomableGroup
            center={currentCenter}
            zoom={currentZoom}
            minZoom={0.5}
            maxZoom={5}
            translateExtent={[[0, 0], [1000, 1000]]}
            onMoveEnd={(position) => setManualView({ center: position.coordinates, zoom: position.zoom })}
          >
            <Geographies geography={lebanonGeo}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => setSelectedEvent(null)}
                    className="lebanon-geography"
                    style={{
                      default: {
                        fill: 'rgba(7, 11, 18, 0.92)',
                        stroke: 'rgba(255, 255, 255, 0.12)',
                        strokeWidth: 0.75,
                        outline: 'none',
                      },
                      hover: {
                        fill: 'rgba(10, 14, 21, 0.96)',
                        stroke: 'rgba(255, 255, 255, 0.14)',
                        strokeWidth: 0.9,
                        outline: 'none',
                      },
                      pressed: {
                        fill: 'rgba(10, 14, 21, 0.96)',
                        stroke: 'rgba(255, 255, 255, 0.14)',
                        strokeWidth: 0.9,
                        outline: 'none',
                      },
                    }}
                  />
                ))
              }
            </Geographies>

            {placeLabels.map((place) => (
              <Marker key={place.key} coordinates={place.coordinates}>
                <g className="pointer-events-none select-none" transform={`scale(${1 / Math.sqrt(currentZoom)})`}>
                  <text
                    y="-8"
                    textAnchor="middle"
                    className="fill-slate-500 text-[8px] font-medium tracking-[0.03em] sm:text-[10px] sm:tracking-[0.06em]"
                    style={{ paintOrder: 'stroke', stroke: 'rgba(7, 11, 18, 0.94)', strokeWidth: 2 }}
                  >
                    {place.label}
                  </text>
                </g>
              </Marker>
            ))}

            {renderedItems.map((item) => (
              <Marker key={item.id} coordinates={[item.lng, item.lat]}>
                <g
                  onClick={() => setSelectedEvent(item)}
                  transform={`scale(${1 / Math.sqrt(currentZoom)})`}
                  className={item.isNew && item.kind === 'event' ? 'pulse-marker cursor-pointer' : 'cursor-pointer'}
                >
                  <circle r={item.radius + 4} fill={item.style.base} opacity={0.11} />
                  <circle
                    r={item.radius}
                    fill={item.style.base}
                    fillOpacity={item.style.fillOpacity}
                    stroke={item.style.base}
                    strokeWidth={item.kind === 'cluster' ? 2.4 : 1.8}
                  />
                  {item.kind === 'cluster' ? (
                    <text y="4" textAnchor="middle" className="fill-white text-[10px] font-semibold sm:text-[12px]">
                      {item.count}
                    </text>
                  ) : null}
                </g>
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {selectedEvent ? (
        <div
          className="pointer-events-auto absolute left-3 right-3 top-3 z-20 rounded-[1.5rem] border-b border-r border-white/5 border-l border-t border-white/20 bg-white/5 p-3.5 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] sm:left-auto sm:right-4 sm:top-6 sm:w-80 sm:max-w-none sm:p-5"
          dir={t.dir}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-bold text-white sm:text-base">
                {selectedEvent.locationName}
              </strong>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-400 sm:text-xs">
                {selectedEvent.kind === 'cluster'
                  ? `${selectedEvent.count} ${t.incidents}`
                  : formatEventLabel(selectedEvent.type, locale)}
              </span>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-300 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:mt-3 sm:text-[13px]">
            {selectedEvent.kind === 'cluster'
              ? t.clusterSummary(selectedEvent.count, formatEventLabel(selectedEvent.type, locale), selectedEvent.locationName)
              : t.incidentIn(formatEventLabel(selectedEvent.type, locale), selectedEvent.locationName)}
          </p>
          {selectedEvent.kind === 'cluster' && selectedEvent.locations.length > 1 ? (
            <div className="mt-2.5 max-h-24 space-y-1 overflow-y-auto pr-1 text-[11px] font-medium text-slate-400 sm:max-h-32 sm:text-xs">
              {selectedEvent.locations.map((location) => (
                <div key={location} className="truncate rounded-md bg-white/5 px-2 py-1.5">
                  {location}
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-2.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase sm:mt-3 sm:text-[11px]">
            {formatPopupTime(selectedEvent.timestamp, locale)}
          </div>
        </div>
      ) : null}

      <LegendOverlay locale={locale} isMobile={isMobile} />
    </div>
  );
}

export default React.memo(MapComponent);
