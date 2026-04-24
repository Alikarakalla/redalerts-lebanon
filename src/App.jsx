import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContents,
  TabsContent,
} from '@/components/animate-ui/components/animate/tabs';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/animate-ui/components/radix/sheet';
import MapComponent from './components/MapComponent';

const LEBANON_CENTER = [33.8547, 35.8623];

const LIVE_STREAMS = {
  mayadeen: {
    id: 'mayadeen',
    youtubeId: 'R9E3xvbZWjw',
    watchUrl: 'https://www.youtube.com/watch?v=R9E3xvbZWjw',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/33/Al_Mayadeen_logo.svg/250px-Al_Mayadeen_logo.svg.png',
    label: 'Al Mayadeen',
    labelAr: '\u0627\u0644\u0645\u064a\u0627\u062f\u064a\u0646',
  },
  jazeera: {
    id: 'jazeera',
    youtubeId: 'bNyUyrR0PHo',
    watchUrl: 'https://www.youtube.com/watch?v=bNyUyrR0PHo',
    logo: 'https://upload.wikimedia.org/wikipedia/fr/thumb/0/0f/Al_Jazeera.svg/120px-Al_Jazeera.svg.png?_=20071211205036',
    label: 'Al Jazeera',
    labelAr: '\u0627\u0644\u062c\u0632\u064a\u0631\u0629',
  },
  alarabiya: {
    id: 'alarabiya',
    youtubeId: 'n7eQejkXbnM',
    watchUrl: 'https://www.youtube.com/watch?v=n7eQejkXbnM',
    logo: 'https://yt3.ggpht.com/GoZXY6BOD_V0vV3ok3fAzIbNMx3og4z2Jd2Up0BnocvBn35rMB4NG3vMOdzOpQ4-HFBUfDQ-JQ=s48-c-k-c0x00ffffff-no-rj',
    label: 'Al Arabiya',
    labelAr: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
  },
  almanar: {
    id: 'almanar',
    embedUrl: 'https://m3u8player.org/player.html?url=https://edge.fastpublish.me/live/index.m3u8',
    logo: 'https://www.almanar.com.lb/framework/assets/images/manar-logo.png',
    label: 'Al Manar',
    labelAr: '\u0627\u0644\u0645\u0646\u0627\u0631',
  },
};

const TRANSLATIONS = {
  en: {
    dir: 'ltr',
    appTitle: 'Red Alerts Lebanon',
    liveFeed: 'Live monitoring feed',
    mappedLive: 'Mapped from the last 24 hours',
    mappedEmpty: 'No incidents in the last 24 hours',
    backendError: 'Backend unavailable',
    connecting: 'Connecting',
    latestReports: 'Latest Reports',
    feedDetails: 'Feed Details',
    mappedTab: 'Mapped',
    telegramTab: 'Channel Feed',
    telegramWire: 'Telegram Wire',
    telegramSource: 'Latest channel posts',
    noWire: 'No Telegram posts available right now.',
    newBadge: 'new',
    markSeen: 'Mark seen',
    unreadPosts: (count) => `${count} unread posts`,
    mappedCount: (count) => `${count} incidents mapped from the last 24 hours`,
    hide: 'Hide',
    open: 'Open',
    noReports: 'No mapped incidents found in the last 24 hours.',
    shareWhatsApp: 'Share to WhatsApp',
    share: 'Share',
    copySummary: 'Copy summary',
    viewOnMap: 'View on Map',
    openDetails: 'Open details',
    liveChannels: 'Live Channels',
    watchLive: 'Watching live now',
    closeLive: 'Close player',
    openOnYoutube: 'Open on YouTube',
    embedFallback: 'If the live stream is blocked here, open it directly on YouTube.',
    incidentIn: (label, location) => `${label} in ${location}`,
    whatsappTitle: 'Red Alerts Lebanon',
    severityPrefix: 'Severity',
    timePrefix: 'Time',
    timeAgoMinutes: (minutes) => `${minutes}m ago`,
    timeAgoHours: (hours, remaining) =>
      remaining ? `${hours}h ${remaining}m ago` : `${hours}h ago`,
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
    severityLabels: {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    },
  },
  ar: {
    dir: 'rtl',
    appTitle: 'Red Alerts Lebanon',
    liveFeed: '\u0628\u062b \u0645\u0631\u0627\u0642\u0629 \u0645\u0628\u0627\u0634\u0631',
    mappedLive: '\u0645\u0631\u0635\u0648\u062f \u0645\u0646 \u0622\u062e\u0631 24 \u0633\u0627\u0639\u0629',
    mappedEmpty: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u062d\u062f\u0627\u062b \u0641\u064a \u0622\u062e\u0631 24 \u0633\u0627\u0639\u0629',
    backendError: '\u0627\u0644\u062e\u0627\u062f\u0645 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d',
    connecting: '\u062c\u0627\u0631\u064d \u0627\u0644\u0627\u062a\u0635\u0627\u0644',
    latestReports: '\u0622\u062e\u0631 \u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631',
    feedDetails: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0628\u062b',
    mappedTab: '\u0627\u0644\u062e\u0631\u064a\u0637\u0629',
    telegramTab: '\u0627\u0644\u0642\u0646\u0627\u0629',
    telegramWire: '\u0633\u0644\u0643 \u062a\u064a\u0644\u064a\u062c\u0631\u0627\u0645',
    telegramSource: '\u0622\u062e\u0631 \u0645\u0646\u0634\u0648\u0631\u0627\u062a \u0627\u0644\u0642\u0646\u0627\u0629',
    noWire: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u0634\u0648\u0631\u0627\u062a \u062a\u064a\u0644\u064a\u062c\u0631\u0627\u0645 \u062d\u0627\u0644\u064a\u0627\u064b.',
    newBadge: '\u062c\u062f\u064a\u062f',
    markSeen: '\u062a\u0645\u062a \u0627\u0644\u0642\u0631\u0627\u0621\u0629',
    unreadPosts: (count) => `${count} \u0645\u0646\u0634\u0648\u0631\u0627\u062a \u063a\u064a\u0631 \u0645\u0642\u0631\u0648\u0621\u0629`,
    mappedCount: (count) => `${count} \u0623\u062d\u062f\u0627\u062b \u0645\u0631\u0635\u0648\u062f\u0629 \u0645\u0646 \u0622\u062e\u0631 24 \u0633\u0627\u0639\u0629`,
    hide: '\u0625\u062e\u0641\u0627\u0621',
    open: '\u0641\u062a\u062d',
    noReports: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u062d\u062f\u0627\u062b \u0645\u0631\u0635\u0648\u062f\u0629 \u0641\u064a \u0622\u062e\u0631 24 \u0633\u0627\u0639\u0629.',
    shareWhatsApp: '\u0645\u0634\u0627\u0631\u0643\u0629 \u0648\u0627\u062a\u0633\u0627\u0628',
    share: '\u0645\u0634\u0627\u0631\u0643\u0629',
    copySummary: '\u0646\u0633\u062e \u0627\u0644\u0645\u0644\u062e\u0635',
    viewOnMap: '\u0639\u0631\u0636 \u0639\u0644\u0649 \u0627\u0644\u062e\u0631\u064a\u0637\u0629',
    openDetails: '\u0641\u062a\u062d \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644',
    liveChannels: '\u0628\u062b \u0645\u0628\u0627\u0634\u0631',
    watchLive: '\u0645\u0634\u0627\u0647\u062f\u0629 \u0627\u0644\u0628\u062b \u0627\u0644\u0622\u0646',
    closeLive: '\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0645\u0634\u063a\u0644',
    openOnYoutube: '\u0641\u062a\u062d \u0639\u0644\u0649 \u064a\u0648\u062a\u064a\u0648\u0628',
    embedFallback: '\u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0628\u062b \u0645\u062d\u062c\u0648\u0628\u0627\u064b \u062f\u0627\u062e\u0644 \u0627\u0644\u0645\u0648\u0642\u0639\u060c \u0627\u0641\u062a\u062d\u0647 \u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0644\u0649 \u064a\u0648\u062a\u064a\u0648\u0628.',
    incidentIn: (label, location) => `${label} \u0641\u064a ${location}`,
    whatsappTitle: 'Red Alerts Lebanon',
    severityPrefix: '\u0627\u0644\u062e\u0637\u0648\u0631\u0629',
    timePrefix: '\u0627\u0644\u0648\u0642\u062a',
    timeAgoMinutes: (minutes) => `\u0645\u0646\u0630 ${minutes} \u062f\u0642\u064a\u0642\u0629`,
    timeAgoHours: (hours, remaining) =>
      remaining ? `\u0645\u0646\u0630 ${hours} \u0633\u0627\u0639\u0629 \u0648${remaining} \u062f\u0642\u064a\u0642\u0629` : `\u0645\u0646\u0630 ${hours} \u0633\u0627\u0639\u0629`,
    eventLabels: {
      explosion: '\u0627\u0646\u0641\u062c\u0627\u0631',
      artillery: '\u0642\u0635\u0641 \u0645\u062f\u0641\u0639\u064a',
      airstrike: '\u063a\u0627\u0631\u0629',
      carAttack: '\u0627\u0633\u062a\u0647\u062f\u0627\u0641 \u0633\u064a\u0627\u0631\u0629',
      warplane: '\u0645\u0642\u0627\u062a\u0644\u0627\u062a \u062d\u0631\u0628\u064a\u0629',
      missile: '\u0635\u0627\u0631\u0648\u062e',
      drone: '\u0645\u0633\u064a\u0631\u0629',
      warning: '\u0627\u0646\u0630\u0627\u0631',
      default: '\u062d\u0627\u062f\u062b',
    },
    severityLabels: {
      high: '\u0645\u0631\u062a\u0641\u0639\u0629',
      medium: '\u0645\u062a\u0648\u0633\u0637\u0629',
      low: '\u0645\u0646\u062e\u0641\u0636\u0629',
    },
  },
};

function getLocaleTag(locale) {
  return locale === 'ar' ? 'ar-LB-u-ca-gregory' : 'en-LB';
}

function formatRelativeTime(timestamp, locale) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  const t = TRANSLATIONS[locale];

  if (minutes < 60) {
    return t.timeAgoMinutes(minutes);
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return t.timeAgoHours(hours, remaining);
}

function formatAbsoluteTime(timestamp, locale) {
  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function formatEventLabel(type, locale) {
  const labels = TRANSLATIONS[locale].eventLabels;
  return labels[type] ?? labels.default;
}

function formatSeverityLabel(severity, locale) {
  const labels = TRANSLATIONS[locale].severityLabels;
  return labels[severity] ?? labels.low;
}

function formatWindowLabel(windowKey, locale) {
  if (windowKey === '30m') {
    return locale === 'ar' ? '\u0622\u062e\u0631 30 \u062f\u0642\u064a\u0642\u0629' : 'Last 30 min';
  }
  if (windowKey === '1h') {
    return locale === 'ar' ? '\u0622\u062e\u0631 \u0633\u0627\u0639\u0629' : 'Last 1h';
  }
  if (windowKey === '2h') {
    return locale === 'ar' ? '\u0622\u062e\u0631 \u0633\u0627\u0639\u062a\u064a\u0646' : 'Last 2h';
  }
  if (windowKey === '3h') {
    return locale === 'ar' ? '\u0622\u062e\u0631 3 \u0633\u0627\u0639\u0627\u062a' : 'Last 3h';
  }
  if (windowKey === '6h') {
    return locale === 'ar' ? '\u0622\u062e\u0631 6 \u0633\u0627\u0639\u0627\u062a' : 'Last 6h';
  }
  if (windowKey === '12h') {
    return locale === 'ar' ? '\u0622\u062e\u0631 12 \u0633\u0627\u0639\u0629' : 'Last 12h';
  }
  return locale === 'ar' ? '\u0622\u062e\u0631 24 \u0633\u0627\u0639\u0629' : 'Last 24h';
}

function LiveTimestamp({ locale }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const clock = setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => clearInterval(clock);
  }, []);

  return new Intl.DateTimeFormat(getLocaleTag(locale), {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(now);
}

function playAlertTone() {
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const audioContext = new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.24);
    oscillator.onended = () => audioContext.close().catch(() => {});
  } catch (_error) {
    // Browsers may block audio until the user interacts with the page.
  }
}

function useStrikeData() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('connecting');

  const hasLoadedOnceRef = useRef(false);
  const previousIdsRef = useRef(new Set());

  useEffect(() => {
    let active = true;

    async function fetchAlerts() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/alerts`);
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        const nextEvents = Array.isArray(payload.alerts) ? payload.alerts : [];
        const incoming = hasLoadedOnceRef.current
          ? nextEvents.filter((event) => !previousIdsRef.current.has(event.id))
          : [];

        setEvents(
          nextEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
        previousIdsRef.current = new Set(nextEvents.map((event) => event.id));
        hasLoadedOnceRef.current = true;


        setStatus(nextEvents.length > 0 ? 'live' : 'empty');
      } catch (error) {
        if (!active) {
          return;
        }

        console.error('Failed to load live alerts:', error);
        setStatus('error');
        setEvents([]);
      }
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return {
    events,
    status,
  };
}

function useTelegramFeed() {
  const [messages, setMessages] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const hasLoadedOnceRef = useRef(false);
  const previousIdsRef = useRef(new Set());

  useEffect(() => {
    let active = true;

    async function fetchTelegramFeed() {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/telegram/latest?limit=8`);
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        const nextMessages = Array.isArray(payload.messages) ? payload.messages : [];
        const incoming = hasLoadedOnceRef.current
          ? nextMessages.filter((message) => !previousIdsRef.current.has(message.id))
          : [];

        setMessages(nextMessages);
        previousIdsRef.current = new Set(nextMessages.map((message) => message.id));

        if (incoming.length > 0) {
          setNewCount((count) => count + incoming.length);
          playAlertTone();
        }

        hasLoadedOnceRef.current = true;
      } catch (error) {
        if (active) {
          console.error('Failed to load Telegram feed:', error);
        }
      }
    }

    fetchTelegramFeed();
    const interval = setInterval(fetchTelegramFeed, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return {
    messages,
    newCount,
    markSeen: () => setNewCount(0),
  };
}

function buildWhatsAppUrl(event, locale) {
  const t = TRANSLATIONS[locale];
  const text = [
    t.whatsappTitle,
    t.incidentIn(formatEventLabel(event.type, locale), event.locationName),
    `${t.severityPrefix}: ${formatSeverityLabel(event.severity, locale)}`,
    `${t.timePrefix}: ${formatAbsoluteTime(event.timestamp, locale)}`,
  ].join('\n');

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function buildEventSummary(event, locale) {
  const t = TRANSLATIONS[locale];
  return [
    t.incidentIn(formatEventLabel(event.type, locale), event.locationName),
    `${event.locationName} · ${formatSeverityLabel(event.severity, locale)}`,
    formatAbsoluteTime(event.timestamp, locale),
  ].join('\n');
}

function IconTooltip({ label, children }) {
  return (
    <Tooltip.Provider delayDuration={120}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={8}
            className="z-[1600] rounded-full border border-white/10 bg-slate-950/95 px-2.5 py-1 text-[11px] font-medium text-slate-100 shadow-xl shadow-black/30"
          >
            {label}
            <Tooltip.Arrow className="fill-slate-950/95" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function ShareButton({ event, locale }) {
  const t = TRANSLATIONS[locale];
  const [open, setOpen] = useState(false);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildEventSummary(event, locale));
      setOpen(false);
    } catch (_error) {
      // Ignore clipboard errors.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, x: locale === 'ar' ? -12 : 12, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: locale === 'ar' ? -12 : 12, scale: 0.9 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex items-center gap-2"
          >
            <IconTooltip label={t.copySummary}>
              <button
                type="button"
                onClick={copySummary}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V6a2 2 0 0 1 2-2h9" />
                </svg>
              </button>
            </IconTooltip>
            <IconTooltip label={t.shareWhatsApp}>
              <a
                href={buildWhatsAppUrl(event, locale)}
                target="_blank"
                rel="noreferrer"
                className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/20"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M19.1 4.9A9.86 9.86 0 0 0 12 2a9.97 9.97 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A9.96 9.96 0 0 0 12 22a10 10 0 0 0 7.1-17.1ZM12 20a7.9 7.9 0 0 1-4-1.1l-.3-.2-2.8.8.8-2.7-.2-.3A8 8 0 1 1 12 20Zm4.4-6.1c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1-.1.2-.5.7-.7.8-.1.1-.2.1-.4 0a6.47 6.47 0 0 1-1.9-1.2 7.1 7.1 0 0 1-1.3-1.6c-.1-.2 0-.3.1-.4l.3-.3.2-.4a.36.36 0 0 0 0-.4c0-.1-.5-1.2-.7-1.6-.2-.4-.3-.3-.5-.3h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.1.9 2.3c.1.2 1.6 2.5 3.9 3.5.5.2 1 .4 1.3.5.6.2 1.1.2 1.5.1.5-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1 0-.1-.2-.2-.4-.3Z" />
                </svg>
              </a>
            </IconTooltip>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
        aria-label={t.share}
        title={t.share}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
          <path d="M12 5v10" />
          <path d="m8 9 4-4 4 4" />
          <path d="M5 19h14" />
        </svg>
      </button>
    </div>
  );
}

function LiveChannelButton({ stream, locale, active, onClick }) {
  const label = locale === 'ar' ? stream.labelAr : stream.label;

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-full border px-2.5 py-2 text-[11px] font-medium transition sm:px-3 sm:text-xs ${
        active
          ? 'border-white/20 bg-white/10 text-white shadow-lg shadow-black/20'
          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
      }`}
      aria-label={label}
      title={label}
    >
      <span className="flex h-5 w-5 items-center justify-center overflow-hidden sm:h-6 sm:w-6">
        <img src={stream.logo} alt={label} className="h-full w-full object-contain" />
      </span>
      <span>{label}</span>
    </motion.button>
  );
}

function LivePlayer({ stream, locale, onClose }) {
  const t = TRANSLATIONS[locale];
  const title = locale === 'ar' ? stream.labelAr : stream.label;
  const embedUrl = stream.youtubeId 
    ? `https://www.youtube-nocookie.com/embed/${stream.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
    : stream.embedUrl;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1400] flex items-center justify-center bg-[#02060dcc] px-4 py-6 backdrop-blur-sm"
        dir={t.dir}
      >
        <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
        <motion.section
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="glass-panel relative w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 shadow-2xl shadow-black/40"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1.5">
                <img src={stream.logo} alt={title} className="h-full w-full object-contain" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                <p className="text-xs text-slate-400">{t.watchLive}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
              aria-label={t.closeLive}
            >
              ✕
            </button>
          </div>
          <div className="relative h-[260px] w-full bg-black sm:h-[420px] lg:h-[620px]">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm text-slate-300 sm:flex-row sm:items-center">
            <p className="text-xs text-slate-400">{t.embedFallback}</p>
            <a
              href={stream.watchUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/25 transition hover:bg-white/10"
            >
              {t.openOnYoutube}
            </a>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}

function ReportCard({ event, locale, onFocus }) {
  const t = TRANSLATIONS[locale];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={`glass-panel rounded-2xl border border-white/10 p-3 shadow-lg shadow-black/20 ${
        locale === 'ar' ? 'text-right' : 'text-left'
      }`}
      dir={t.dir}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-slate-100">
              <span className="block truncate">
                {t.incidentIn(formatEventLabel(event.type, locale), event.locationName)}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <ShareButton event={event} locale={locale} />
              <IconTooltip label={t.viewOnMap}>
                <button
                  type="button"
                  onClick={() => onFocus(event)}
                  aria-label={t.viewOnMap}
                  title={t.viewOnMap}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-200 transition hover:bg-red-500/20"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
                    <path d="M15 6.5 20 5v13l-5 1.5-6-1.5L4 19.5V6.5L9 5l6 1.5Z" />
                    <path d="M9 5v13m6-11.5v13" />
                  </svg>
                </button>
              </IconTooltip>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {event.locationName} · {formatSeverityLabel(event.severity, locale)}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span>{formatRelativeTime(event.timestamp, locale)}</span>
            <span>{formatAbsoluteTime(event.timestamp, locale)}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function TelegramWire({ locale, messages, newCount, onSeen, onOpenMessage }) {
  const t = TRANSLATIONS[locale];

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" dir={t.dir}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{t.telegramWire}</h3>
          {newCount > 0 ? (
            <motion.span
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white"
            >
              {newCount} {t.newBadge}
            </motion.span>
          ) : null}
        </div>
        {newCount > 0 ? (
          <button
            type="button"
            onClick={onSeen}
            className="text-[11px] font-medium text-slate-400 transition hover:text-white"
          >
            {t.markSeen}
          </button>
        ) : (
          <span className="text-[11px] text-slate-500">{t.telegramSource}</span>
        )}
      </div>

      <div className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {messages.length > 0 ? (
            messages.map((message, index) => (
              <motion.button
                key={message.id}
                type="button"
                onClick={() => onOpenMessage(message)}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className={`block w-full rounded-xl border px-3 py-2 text-left ${
                  index < newCount
                    ? 'border-red-400/20 bg-red-500/10 shadow-lg shadow-red-950/20'
                    : 'border-white/8 bg-white/[0.02]'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                  <span>{message.channel}</span>
                  <span>{formatAbsoluteTime(message.timestamp, locale)}</span>
                </div>
                <p className="line-clamp-4 text-xs leading-5 text-slate-200">{message.text}</p>
              </motion.button>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-xs text-slate-500"
            >
              {t.noWire}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function TelegramMessageDialog({ locale, message, onOpenChange }) {
  const t = TRANSLATIONS[locale];
  const open = Boolean(message);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onOpenChange(null)}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1450] bg-[#02060dcc] backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 16 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="glass-panel fixed left-1/2 top-1/2 z-[1500] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-white/10 p-5 shadow-2xl shadow-black/40"
                dir={t.dir}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Dialog.Title className="text-lg font-semibold text-white">
                      {t.telegramWire}
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-slate-400">
                      {message?.channel} · {message ? formatAbsoluteTime(message.timestamp, locale) : ''}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                    >
                      ✕
                    </button>
                  </Dialog.Close>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                    {message?.text}
                  </p>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function SidebarPanel({
  locale,
  events,
  messages,
  newCount,
  sidebarTab,
  onTabChange,
  onSeen,
  onFocus,
  onOpenMessage,
  drawerOpen,
  onToggleDrawer,
}) {
  const t = TRANSLATIONS[locale];

  return (
    <Tabs
      value={sidebarTab}
      onValueChange={onTabChange}
      className="flex h-full flex-col"
      dir={t.dir}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{t.latestReports}</h2>
          <p className="text-xs tracking-[0.16em] text-slate-500">
            {sidebarTab === 'mapped' ? t.mappedCount(events.length) : t.telegramSource}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleDrawer}
          className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 md:hidden"
        >
          {drawerOpen ? t.hide : t.open}
        </button>
      </div>

      <Accordion.Root type="single" collapsible defaultValue="feed-details" className="mb-4">
        <Accordion.Item value="feed-details" className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-white">
              <span>{t.feedDetails}</span>
              <motion.span
                animate={{ rotate: 0 }}
                className="text-slate-500 transition group-data-[state=open]:rotate-180"
              >
                ⌄
              </motion.span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="px-3 pb-3 text-xs text-slate-400">
            <div className="flex items-center justify-between py-1">
              <span>{t.mappedTab}</span>
              <span>{events.length}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>{t.telegramTab}</span>
              <span>{messages.length}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>{t.newBadge}</span>
              <span>{t.unreadPosts(newCount)}</span>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>

      <TabsList className="mb-4 grid h-auto w-full grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {[
          { value: 'mapped', label: t.mappedTab ?? t.latestReports, badge: 0 },
          { value: 'wire', label: t.telegramTab ?? t.telegramWire, badge: newCount },
        ].map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="rounded-xl px-3 py-2 text-sm font-medium text-slate-400 outline-none transition data-[state=active]:text-white"
          >
            <span className="inline-flex items-center gap-2">
              {tab.label}
              {tab.badge > 0 ? (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {tab.badge}
                </span>
              ) : null}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContents className="min-h-0 flex-1">
        <TabsContent value="mapped" className="min-h-0 h-full overflow-hidden">
          <div className="h-full space-y-3 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {events.length > 0 ? (
                events.map((event) => (
                  <ReportCard
                    key={event.id}
                    event={event}
                    locale={locale}
                    onFocus={(item) => onFocus(item)}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500"
                >
                  {t.noReports}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TabsContent>
 
        <TabsContent value="wire" className="min-h-0 h-full overflow-hidden">
          <TelegramWire
            locale={locale}
            messages={messages}
            newCount={newCount}
            onSeen={onSeen}
            onOpenMessage={onOpenMessage}
          />
        </TabsContent>
      </TabsContents>
    </Tabs>
  );
}

function FilterSheetButton({ locale, activeType, activeWindow, setActiveType, setActiveWindow }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 text-xs font-medium text-slate-200 shadow-xl shadow-black/30 backdrop-blur-xl transition hover:bg-black/85 hover:text-white"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">{locale === 'ar' ? '\u0627\u0644\u0641\u0644\u0627\u062a\u0631' : 'Filters'}</span>
        </button>
      </SheetTrigger>
      <SheetContent side={locale === 'ar' ? 'left' : 'right'} className="w-[min(92vw,24rem)]">
        <SheetHeader className="border-b border-white/10 pb-4">
          <SheetTitle>{locale === 'ar' ? '\u0641\u0644\u0627\u062a\u0631 \u0627\u0644\u062e\u0631\u064a\u0637\u0629' : 'Map Filters'}</SheetTitle>
          <SheetDescription>
            {locale === 'ar'
              ? '\u0627\u062e\u062a\u0631 \u0646\u0648\u0639 \u0627\u0644\u062d\u062f\u062b \u0648\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0632\u0645\u0646\u064a.'
              : 'Choose event types and time range.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-6">
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              {locale === 'ar' ? '\u0646\u0648\u0639 \u0627\u0644\u062d\u062f\u062b' : 'Event Type'}
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTER_TYPES.map((type) => {
                const label = getTypeFilterLabel(type, locale);
                const isActive = activeType === type;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'border-white/18 bg-white/12 text-white'
                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              {locale === 'ar' ? '\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0632\u0645\u0646\u064a' : 'Time Range'}
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTER_WINDOWS.map((windowKey) => {
                const label = formatWindowLabel(windowKey, locale);
                const isActive = activeWindow === windowKey;

                return (
                  <button
                    key={windowKey}
                    type="button"
                    onClick={() => setActiveWindow(windowKey)}
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'border-white/18 bg-white/10 text-white'
                        : 'border-white/8 bg-white/[0.03] text-slate-500 hover:bg-white/[0.07] hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}


const FILTER_TYPES = ['all', 'drone', 'warplane', 'airstrike', 'carAttack', 'artillery', 'explosion', 'missile', 'warning'];
const FILTER_WINDOWS = ['30m', '1h', '2h', '3h', '6h', '12h', '24h'];

function getTypeFilterLabel(type, locale) {
  if (type === 'all') {
    return locale === 'ar' ? '\u0627\u0644\u0643\u0644' : 'All';
  }

  return formatEventLabel(type, locale);
}

function App() {
  const { events, status } = useStrikeData();
  const [locale, setLocale] = useState('ar');
  const [activeStreamId, setActiveStreamId] = useState(null);
  const [focusedEvent, setFocusedEvent] = useState(null);
  const [activeType, setActiveType] = useState('all');
  const [activeWindow, setActiveWindow] = useState('2h');
  const [isTopAreaCollapsed, setIsTopAreaCollapsed] = useState(true);
  const shellRef = useRef(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/track`, { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || window.matchMedia('(pointer: coarse)').matches) {
      return undefined;
    }

    let frameId = null;

    const updatePointerGlow = (event) => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        shell.style.setProperty('--cursor-x', `${event.clientX}px`);
        shell.style.setProperty('--cursor-y', `${event.clientY}px`);
        shell.style.setProperty('--cursor-opacity', '1');
      });
    };

    const hidePointerGlow = () => {
      shell.style.setProperty('--cursor-opacity', '0');
    };

    window.addEventListener('pointermove', updatePointerGlow, { passive: true });
    window.addEventListener('pointerleave', hidePointerGlow);
    window.addEventListener('blur', hidePointerGlow);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('pointermove', updatePointerGlow);
      window.removeEventListener('pointerleave', hidePointerGlow);
      window.removeEventListener('blur', hidePointerGlow);
    };
  }, []);

  const t = TRANSLATIONS[locale];
  const activeStream = activeStreamId ? LIVE_STREAMS[activeStreamId] : null;
  const activeWindowLabel = formatWindowLabel(activeWindow, locale);

  const statusText =
    status === 'live'
      ? `${locale === 'ar' ? '\u0645\u0631\u0635\u0648\u062f \u0645\u0646' : 'Mapped from'} ${activeWindowLabel}`
      : status === 'empty'
        ? locale === 'ar'
          ? `\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u062d\u062f\u0627\u062b \u0641\u064a ${activeWindowLabel}`
          : `No incidents in ${activeWindowLabel}`
        : status === 'error'
          ? t.backendError
          : t.connecting;

  return (
    <div ref={shellRef} className="workspace-shell min-h-screen text-slate-100" dir={t.dir}>

      <div className="fixed left-3 top-3 z-[1200] flex max-w-[calc(100vw-1.5rem)] items-center gap-2">
        <button
          type="button"
          onClick={() => setIsTopAreaCollapsed((current) => !current)}
          aria-label={isTopAreaCollapsed ? 'Show top area' : 'Hide top area'}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/70 text-slate-100 shadow-xl shadow-black/30 backdrop-blur-xl transition hover:bg-black/85 hover:text-white"
        >
          {isTopAreaCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </button>
        <FilterSheetButton
          locale={locale}
          activeType={activeType}
          activeWindow={activeWindow}
          setActiveType={setActiveType}
          setActiveWindow={setActiveWindow}
        />
      </div>

      <div
        className={`mx-auto flex min-h-screen flex-col transition-all ${
          isTopAreaCollapsed
            ? 'max-w-none px-0 py-0'
            : 'max-w-[1800px] px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6'
        }`}
      >
        {!isTopAreaCollapsed && (
        <header className="workspace-header mb-2 flex flex-col gap-2 px-1 py-1 pl-12 sm:mb-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="live-dot shrink-0" />
            <div className="min-w-0">
              <h1 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white sm:text-[13px] md:truncate md:text-base md:tracking-[0.3em]">
                {t.appTitle}
              </h1>
              <p className="mt-1 max-w-[28rem] text-[10px] leading-4 text-slate-400 sm:text-[11px] md:leading-5">
                {t.liveFeed} | <LiveTimestamp locale={locale} /> | {statusText}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex md:flex-wrap md:justify-end">
            <div className="flex items-center gap-2 md:flex-wrap md:justify-end">
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.26em] text-slate-600 xl:inline">
                {t.liveChannels}
              </span>
              <LiveChannelButton
                stream={LIVE_STREAMS.mayadeen}
                locale={locale}
                active={activeStreamId === 'mayadeen'}
                onClick={() => setActiveStreamId((current) => (current === 'mayadeen' ? null : 'mayadeen'))}
              />
              <LiveChannelButton
                stream={LIVE_STREAMS.jazeera}
                locale={locale}
                active={activeStreamId === 'jazeera'}
                onClick={() => setActiveStreamId((current) => (current === 'jazeera' ? null : 'jazeera'))}
              />
              <LiveChannelButton
                stream={LIVE_STREAMS.alarabiya}
                locale={locale}
                active={activeStreamId === 'alarabiya'}
                onClick={() => setActiveStreamId((current) => (current === 'alarabiya' ? null : 'alarabiya'))}
              />
              <LiveChannelButton
                stream={LIVE_STREAMS.almanar}
                locale={locale}
                active={activeStreamId === 'almanar'}
                onClick={() => setActiveStreamId((current) => (current === 'almanar' ? null : 'almanar'))}
              />
            </div>
          </div>
        </header>
        )}

        <main className={`relative flex flex-1 flex-col ${isTopAreaCollapsed ? 'min-h-screen' : 'min-h-0'}`}>
          {!isTopAreaCollapsed && (
          <div className="mb-3 hidden flex-col gap-2 md:mb-4 md:flex">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTER_TYPES.map((type) => {
                const label = getTypeFilterLabel(type, locale);
                const isActive = activeType === type;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-medium transition sm:text-xs ${
                      isActive
                        ? 'border-white/18 bg-white/12 text-white'
                        : 'border-white/8 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {FILTER_WINDOWS.map((windowKey) => {
                  const label = formatWindowLabel(windowKey, locale);
                  const isActive = activeWindow === windowKey;

                  return (
                    <button
                      key={windowKey}
                      type="button"
                      onClick={() => setActiveWindow(windowKey)}
                      className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-medium transition sm:text-xs ${
                        isActive
                          ? 'border-white/18 bg-white/10 text-white'
                          : 'border-white/8 bg-white/[0.03] text-slate-500 hover:bg-white/[0.07] hover:text-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          )}

          {!isTopAreaCollapsed && (
          <div className="mb-3 flex flex-col gap-2 md:hidden">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <LiveChannelButton
                stream={LIVE_STREAMS.mayadeen}
                locale={locale}
                active={activeStreamId === 'mayadeen'}
                onClick={() => setActiveStreamId((current) => (current === 'mayadeen' ? null : 'mayadeen'))}
              />
              <LiveChannelButton
                stream={LIVE_STREAMS.jazeera}
                locale={locale}
                active={activeStreamId === 'jazeera'}
                onClick={() => setActiveStreamId((current) => (current === 'jazeera' ? null : 'jazeera'))}
              />
              <LiveChannelButton
                stream={LIVE_STREAMS.alarabiya}
                locale={locale}
                active={activeStreamId === 'alarabiya'}
                onClick={() => setActiveStreamId((current) => (current === 'alarabiya' ? null : 'alarabiya'))}
              />
              <LiveChannelButton
                stream={LIVE_STREAMS.almanar}
                locale={locale}
                active={activeStreamId === 'almanar'}
                onClick={() => setActiveStreamId((current) => (current === 'almanar' ? null : 'almanar'))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>{locale === 'ar' ? '\u0627\u0644\u0641\u0644\u0627\u062a\u0631' : 'Filters'}</span>
                  </button>
                </SheetTrigger>
                <SheetContent side={locale === 'ar' ? 'left' : 'right'} className="w-[min(92vw,24rem)]">
                  <SheetHeader className="border-b border-white/10 pb-4">
                    <SheetTitle>{locale === 'ar' ? '\u0641\u0644\u0627\u062a\u0631 \u0627\u0644\u062e\u0631\u064a\u0637\u0629' : 'Map Filters'}</SheetTitle>
                    <SheetDescription>
                      {locale === 'ar'
                        ? '\u0627\u062e\u062a\u0631 \u0646\u0648\u0639 \u0627\u0644\u062d\u062f\u062b \u0648\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0632\u0645\u0646\u064a.'
                        : 'Choose event types and time range.'}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="flex flex-col gap-5 px-4 pb-6">
                    <div>
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                        {locale === 'ar' ? '\u0646\u0648\u0639 \u0627\u0644\u062d\u062f\u062b' : 'Event Type'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {FILTER_TYPES.map((type) => {
                          const label = getTypeFilterLabel(type, locale);
                          const isActive = activeType === type;

                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setActiveType(type)}
                              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                isActive
                                  ? 'border-white/18 bg-white/12 text-white'
                                  : 'border-white/8 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                        {locale === 'ar' ? '\u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0632\u0645\u0646\u064a' : 'Time Range'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {FILTER_WINDOWS.map((windowKey) => {
                          const label = formatWindowLabel(windowKey, locale);
                          const isActive = activeWindow === windowKey;

                          return (
                            <button
                              key={windowKey}
                              type="button"
                              onClick={() => setActiveWindow(windowKey)}
                              className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                isActive
                                  ? 'border-white/18 bg-white/10 text-white'
                                  : 'border-white/8 bg-white/[0.03] text-slate-500 hover:bg-white/[0.07] hover:text-slate-200'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1" />
            </div>
          </div>
          )}

          <MapComponent
            events={events}
            focusedEvent={focusedEvent}
            locale={locale}
            activeType={activeType}
            activeWindow={activeWindow}
          />
        </main>
      </div>

      {activeStream && status !== 'error' && (
        <LivePlayer
          stream={activeStream}
          locale={locale}
          onClose={() => setActiveStreamId(null)}
        />
      )}

      
    </div>
  );
}

export default App;
