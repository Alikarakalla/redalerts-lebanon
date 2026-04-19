import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import * as Tooltip from '@radix-ui/react-tooltip';
import MapComponent from './components/MapComponent';

const LEBANON_CENTER = [33.8547, 35.8623];

const LIVE_STREAMS = {
  mayadeen: {
    id: 'mayadeen',
    youtubeId: 'R9E3xvbZWjw',
    watchUrl: 'https://www.youtube.com/watch?v=R9E3xvbZWjw',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/33/Al_Mayadeen_logo.svg/250px-Al_Mayadeen_logo.svg.png',
    label: 'Al Mayadeen',
    labelAr: 'الميادين',
  },
  jazeera: {
    id: 'jazeera',
    youtubeId: 'bNyUyrR0PHo',
    watchUrl: 'https://www.youtube.com/watch?v=bNyUyrR0PHo',
    logo: 'https://upload.wikimedia.org/wikipedia/fr/thumb/0/0f/Al_Jazeera.svg/120px-Al_Jazeera.svg.png?_=20071211205036',
    label: 'Al Jazeera',
    labelAr: 'الجزيرة',
  },
};

const TRANSLATIONS = {
  en: {
    dir: 'ltr',
    appTitle: 'Lebanon Conflict & Crisis Tracker',
    liveFeed: 'Live monitoring feed',
    mappedLive: 'Mapped from the last 24 hours',
    mappedEmpty: 'No incidents in the last 24 hours',
    backendError: 'Backend unavailable',
    connecting: 'Connecting',
    batterySaver: 'Battery Saver',
    showMap: 'Show Map',
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
    batteryTitle: 'Battery Saver Mode',
    batteryText: 'Map rendering is paused. Live reports remain active in the text feed.',
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
    whatsappTitle: 'Lebanon Conflict Tracker',
    severityPrefix: 'Severity',
    timePrefix: 'Time',
    timeAgoMinutes: (minutes) => `${minutes}m ago`,
    timeAgoHours: (hours, remaining) =>
      remaining ? `${hours}h ${remaining}m ago` : `${hours}h ago`,
    eventLabels: {
      explosion: 'Explosion',
      artillery: 'Artillery',
      airstrike: 'Airstrike',
      missile: 'Missile',
      drone: 'Drone',
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
    appTitle: 'متتبع الأزمات والتصعيد في لبنان',
    liveFeed: 'بث مراقبة مباشر',
    mappedLive: 'مرصود من آخر 24 ساعة',
    mappedEmpty: 'لا توجد أحداث في آخر 24 ساعة',
    backendError: 'الخادم غير متاح',
    connecting: 'جارٍ الاتصال',
    batterySaver: 'توفير البطارية',
    showMap: 'إظهار الخريطة',
    latestReports: 'آخر التقارير',
    feedDetails: 'تفاصيل البث',
    mappedTab: 'الخرائط',
    telegramTab: 'القناة',
    telegramWire: 'سلك تيليجرام',
    telegramSource: 'آخر منشورات القناة',
    noWire: 'لا توجد منشورات تيليجرام حاليًا.',
    newBadge: 'جديد',
    markSeen: 'تمت القراءة',
    unreadPosts: (count) => `${count} منشورات غير مقروءة`,
    mappedCount: (count) => `${count} أحداث مرصودة من آخر 24 ساعة`,
    hide: 'إخفاء',
    open: 'فتح',
    noReports: 'لا توجد أحداث مرصودة في آخر 24 ساعة.',
    batteryTitle: 'وضع توفير البطارية',
    batteryText: 'تم إيقاف عرض الخريطة مؤقتًا. تبقى التقارير المباشرة متاحة في القائمة.',
    shareWhatsApp: 'مشاركة واتساب',
    share: 'مشاركة',
    copySummary: 'نسخ الملخص',
    viewOnMap: 'عرض على الخريطة',
    openDetails: 'فتح التفاصيل',
    liveChannels: 'بث مباشر',
    watchLive: 'مشاهدة البث الآن',
    closeLive: 'إغلاق المشغل',
    openOnYoutube: 'فتح على يوتيوب',
    embedFallback: 'إذا كان البث محجوبًا داخل الموقع، افتحه مباشرة على يوتيوب.',
    incidentIn: (label, location) => `${label} في ${location}`,
    whatsappTitle: 'متتبع الأزمات والتصعيد في لبنان',
    severityPrefix: 'الخطورة',
    timePrefix: 'الوقت',
    timeAgoMinutes: (minutes) => `منذ ${minutes} دقيقة`,
    timeAgoHours: (hours, remaining) =>
      remaining ? `منذ ${hours} ساعة و${remaining} دقيقة` : `منذ ${hours} ساعة`,
    eventLabels: {
      explosion: 'انفجار',
      artillery: 'قصف مدفعي',
      airstrike: 'غارة',
      missile: 'صاروخ',
      drone: 'مسيّرة',
      default: 'حادث',
    },
    severityLabels: {
      high: 'مرتفعة',
      medium: 'متوسطة',
      low: 'منخفضة',
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

  useEffect(() => {
    let active = true;

    async function fetchAlerts() {
      try {
        const response = await fetch('/api/alerts');
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        const nextEvents = Array.isArray(payload.alerts) ? payload.alerts : [];
        setEvents(
          nextEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        );
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

  return { events, status };
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
        const response = await fetch('/api/telegram/latest?limit=8');
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

function BatterySwitch({ checked, onCheckedChange, label }) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
      <span>{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={`relative h-5 w-10 rounded-full border border-white/10 transition ${
          checked ? 'bg-emerald-500/70' : 'bg-slate-700'
        }`}
        aria-label={label}
      >
        <Switch.Thumb asChild>
          <motion.span
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white ${
              checked ? 'left-5' : 'left-0.5'
            }`}
          />
        </Switch.Thumb>
      </Switch.Root>
    </label>
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
      className={`relative flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
        active
          ? 'border-white/20 bg-white/10 text-white shadow-lg shadow-black/20'
          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
      }`}
      aria-label={label}
      title={label}
    >
      <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5 p-1">
        <img src={stream.logo} alt={label} className="h-full w-full object-contain" />
      </span>
      <span className="hidden lg:inline">{label}</span>
    </motion.button>
  );
}

function LivePlayer({ stream, locale, onClose }) {
  const t = TRANSLATIONS[locale];
  const title = locale === 'ar' ? stream.labelAr : stream.label;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${stream.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

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
    <Tabs.Root
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

      <Tabs.List className="mb-4 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {[
          { value: 'mapped', label: t.mappedTab ?? t.latestReports, badge: 0 },
          { value: 'wire', label: t.telegramTab ?? t.telegramWire, badge: newCount },
        ].map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="relative rounded-xl px-3 py-2 text-sm font-medium text-slate-400 outline-none transition data-[state=active]:text-white"
          >
            {sidebarTab === tab.value ? (
              <motion.span
                layoutId="sidebar-tab-indicator"
                className="absolute inset-0 rounded-xl border border-white/10 bg-white/10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-2">
              {tab.label}
              {tab.badge > 0 ? (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {tab.badge}
                </span>
              ) : null}
            </span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="mapped" className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
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
      </Tabs.Content>

      <Tabs.Content value="wire" className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <TelegramWire
          locale={locale}
          messages={messages}
          newCount={newCount}
          onSeen={onSeen}
          onOpenMessage={onOpenMessage}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}

function LanguageToggle({ locale, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
    >
      {locale === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}

function App() {
  const { events, status } = useStrikeData();
  const { messages, newCount, markSeen } = useTelegramFeed();
  const [locale, setLocale] = useState('ar');
  const [activeStreamId, setActiveStreamId] = useState(null);
  const [focusedEvent, setFocusedEvent] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [batterySaver, setBatterySaver] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('mapped');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const clock = setInterval(() => {
      setNow(Date.now());
    }, 5000);

    return () => clearInterval(clock);
  }, []);

  const t = TRANSLATIONS[locale];
  const activeStream = activeStreamId ? LIVE_STREAMS[activeStreamId] : null;
  const statusText =
    status === 'live'
      ? t.mappedLive
      : status === 'empty'
        ? t.mappedEmpty
        : status === 'error'
          ? t.backendError
          : t.connecting;

  function focusEvent(item) {
    setFocusedEvent(item);
    setDrawerOpen(false);
    setBatterySaver(false);
  }

  const sidebarPanel = (
    <SidebarPanel
      locale={locale}
      events={events}
      messages={messages}
      newCount={newCount}
      sidebarTab={sidebarTab}
      onTabChange={(value) => {
        setSidebarTab(value);
        if (value === 'wire') {
          markSeen();
        }
      }}
      onSeen={markSeen}
      onFocus={focusEvent}
      onOpenMessage={(message) => {
        setSelectedMessage(message);
        if (sidebarTab !== 'wire') {
          setSidebarTab('wire');
        }
      }}
      drawerOpen={drawerOpen}
      onToggleDrawer={() => setDrawerOpen((open) => !open)}
    />
  );

  return (
    <div className="min-h-screen bg-[#07111a] text-slate-100" dir={t.dir}>
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 md:px-4 md:py-4">
        <header className="glass-panel mb-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="live-dot shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold uppercase tracking-[0.3em] text-white md:text-base">
                {t.appTitle}
              </h1>
              <p className="text-xs text-slate-400">
                {t.liveFeed} |{' '}
                {new Intl.DateTimeFormat(getLocaleTag(locale), {
                  dateStyle: 'full',
                  timeStyle: 'medium',
                }).format(now)}{' '}
                | {statusText}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 xl:inline">
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
            </div>
            <LanguageToggle
              locale={locale}
              onToggle={() => setLocale((current) => (current === 'ar' ? 'en' : 'ar'))}
            />
            <BatterySwitch
              checked={batterySaver}
              onCheckedChange={setBatterySaver}
              label={t.batterySaver}
            />
          </div>
        </header>

        <div className="flex flex-1 gap-3 overflow-hidden">
          <aside className="glass-panel hidden w-[380px] shrink-0 rounded-3xl p-4 md:block">
            {sidebarPanel}
          </aside>

          <main className="relative min-h-[70vh] flex-1 overflow-hidden rounded-3xl">
            <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
              <div className="flex items-center gap-2">
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
              </div>
              <LanguageToggle
                locale={locale}
                onToggle={() => setLocale((current) => (current === 'ar' ? 'en' : 'ar'))}
              />
              <BatterySwitch
                checked={batterySaver}
                onCheckedChange={setBatterySaver}
                label={batterySaver ? t.showMap : t.batterySaver}
              />
            </div>

            {batterySaver ? (
              <section className="glass-panel flex h-full min-h-[70vh] flex-col rounded-3xl p-4" dir={t.dir}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">{t.batteryTitle}</h2>
                  <p className="text-sm text-slate-400">{t.batteryText}</p>
                </div>
                <div className="space-y-3 overflow-y-auto">
                  <AnimatePresence initial={false}>
                    {events.length > 0 ? (
                      events.map((event) => (
                        <ReportCard
                          key={event.id}
                          event={event}
                          locale={locale}
                          onFocus={focusEvent}
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
              </section>
            ) : (
              <MapComponent
                center={LEBANON_CENTER}
                events={events}
                focusedEvent={focusedEvent}
                locale={locale}
              />
            )}
          </main>
        </div>
      </div>

      <div
        className={`mobile-drawer glass-panel fixed inset-x-3 bottom-3 z-[1200] rounded-[28px] border border-white/10 p-3 md:hidden ${
          drawerOpen ? 'translate-y-0' : 'translate-y-[calc(100%-56px)]'
        }`}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          className="mx-auto mb-3 block h-1.5 w-14 rounded-full bg-white/20"
          aria-label={t.latestReports}
        />
        {sidebarPanel}
      </div>

      {activeStream ? (
        <LivePlayer
          stream={activeStream}
          locale={locale}
          onClose={() => setActiveStreamId(null)}
        />
      ) : null}
      <TelegramMessageDialog
        locale={locale}
        message={selectedMessage}
        onOpenChange={setSelectedMessage}
      />
    </div>
  );
}

export default App;
