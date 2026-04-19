import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const LEBANON_BOUNDS = [
  [32.95, 35.05],
  [34.75, 36.7],
];

const MAP_TRANSLATIONS = {
  en: {
    dir: 'ltr',
    eventLabels: {
      explosion: 'Explosion',
      artillery: 'Artillery',
      airstrike: 'Airstrike',
      missile: 'Missile',
      drone: 'Drone',
      default: 'Incident',
    },
    locating: 'Locating...',
    nearMe: 'GPS / Near Me',
    legend: 'Legend',
    fresh: 'Fresh event under 30 min',
    recent: 'Recent event under 2 hours',
    old: 'Older than 2 hours',
    incidentIn: (label, location) => `${label} in ${location}`,
  },
  ar: {
    dir: 'rtl',
    eventLabels: {
      explosion: 'انفجار',
      artillery: 'قصف مدفعي',
      airstrike: 'غارة',
      missile: 'صاروخ',
      drone: 'مسيّرة',
      default: 'حادث',
    },
    locating: 'جارِ تحديد الموقع...',
    nearMe: 'موقعي / GPS',
    legend: 'الدليل',
    fresh: 'حدث جديد خلال أقل من 30 دقيقة',
    recent: 'حدث حديث خلال أقل من ساعتين',
    old: 'أقدم من ساعتين',
    incidentIn: (label, location) => `${label} في ${location}`,
  },
};

function getLocaleTag(locale) {
  return locale === 'ar' ? 'ar-LB-u-ca-gregory' : 'en-LB';
}

function getEventAgeMinutes(timestamp) {
  return (Date.now() - new Date(timestamp).getTime()) / 60000;
}

function getMarkerColor(timestamp) {
  const ageMinutes = getEventAgeMinutes(timestamp);

  if (ageMinutes <= 30) {
    return '#ff4d5a';
  }

  if (ageMinutes <= 120) {
    return '#d7263d';
  }

  return '#5b0f18';
}

function getMarkerRadius(severity) {
  switch (severity) {
    case 'high':
      return 18;
    case 'medium':
      return 14;
    default:
      return 10;
  }
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

function FlyToFocusedEvent({ focusedEvent }) {
  const map = useMap();

  useEffect(() => {
    if (!focusedEvent) {
      return;
    }

    map.flyTo([focusedEvent.lat, focusedEvent.lng], 11, {
      duration: 1.4,
    });
  }, [focusedEvent, map]);

  return null;
}

function ResetToLebanonBounds() {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(LEBANON_BOUNDS, {
      padding: [24, 24],
    });
  }, [map]);

  return null;
}

function NearMeControl({ locale }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const t = MAP_TRANSLATIONS[locale];

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        map.flyTo([coords.latitude, coords.longitude], 11, { duration: 1.2 });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <button
      type="button"
      onClick={handleNearMe}
      className="pointer-events-auto absolute bottom-6 right-4 z-[1000] rounded-2xl border border-white/10 bg-[#08121bcc] px-4 py-3 text-sm font-medium text-white shadow-lg shadow-black/30 backdrop-blur-xl transition hover:bg-[#0d1b27]"
    >
      {locating ? t.locating : t.nearMe}
    </button>
  );
}

function LegendOverlay({ locale }) {
  const t = MAP_TRANSLATIONS[locale];

  return (
    <div
      className="pointer-events-none absolute bottom-6 left-4 z-[1000] w-52 rounded-2xl border border-white/10 bg-[#08121bcc] p-4 shadow-lg shadow-black/30 backdrop-blur-xl"
      dir={t.dir}
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">{t.legend}</h3>
      <div className="space-y-2 text-xs text-slate-300">
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
    </div>
  );
}

function MapComponent({ center, events, focusedEvent, locale = 'ar' }) {
  const renderedEvents = useMemo(
    () =>
      events.map((event) => {
        const ageMinutes = getEventAgeMinutes(event.timestamp);
        return {
          ...event,
          color: getMarkerColor(event.timestamp),
          isNew: ageMinutes <= 30,
          radius: getMarkerRadius(event.severity),
        };
      }),
    [events]
  );

  const t = MAP_TRANSLATIONS[locale];

  return (
    <div className="relative h-full min-h-[70vh] overflow-hidden rounded-3xl">
      <MapContainer
        center={center}
        zoom={8}
        zoomControl={false}
        minZoom={8}
        maxBounds={LEBANON_BOUNDS}
        maxBoundsViscosity={1}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <ResetToLebanonBounds />
        <FlyToFocusedEvent focusedEvent={focusedEvent} />

        {renderedEvents.map((event) => (
          <CircleMarker
            key={event.id}
            center={[event.lat, event.lng]}
            radius={event.radius}
            pathOptions={{
              color: event.color,
              fillColor: event.color,
              fillOpacity: 0.4,
              weight: 2,
              className: event.isNew ? 'pulse-marker' : '',
            }}
          >
            <Popup>
              <div className="min-w-[220px] space-y-2 text-sm" dir={t.dir}>
                <div className="flex items-center justify-between gap-2">
                  <strong>{event.locationName}</strong>
                  <span className="text-xs text-slate-500">{formatEventLabel(event.type, locale)}</span>
                </div>
                <p className="text-slate-700">
                  {t.incidentIn(formatEventLabel(event.type, locale), event.locationName)}
                </p>
                <div className="text-xs text-slate-500">{formatPopupTime(event.timestamp, locale)}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        <LegendOverlay locale={locale} />
        <NearMeControl locale={locale} />
      </MapContainer>
    </div>
  );
}

export default MapComponent;
