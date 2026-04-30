import { useEffect, useRef, useState } from 'react';

function getPositionClasses(position = 'top-right') {
  const map = {
    'top-right': 'top-5 right-5 items-end',
    'top-center': 'top-5 left-1/2 items-center',
    'bottom-right': 'bottom-5 right-5 items-end',
    'bottom-center': 'bottom-5 left-1/2 items-center',
  };

  return map[position] ?? map['top-right'];
}

function getEnterTransform(position = 'top-right') {
  if (position.includes('right')) return 'translate(24px, -8px)';
  if (position.includes('left')) return 'translate(-24px, -8px)';
  if (position.startsWith('top')) return 'translate(-50%, -20px)';
  return 'translate(-50%, 20px)';
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(239,68,68,0.14)"
      />
      <line x1="12" y1="9" x2="12" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="#ef4444" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function WarningToast({
  open = false,
  title = 'Warning',
  message = '',
  duration = 15000,
  onClose,
  onClick,
  position = 'top-right',
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const closeTimer = useRef(null);
  const progressTimer = useRef(null);
  const startTime = useRef(null);

  useEffect(() => {
    if (open) {
      setExiting(false);
      setProgress(100);
      setVisible(true);
      startTime.current = Date.now();

      if (duration > 0) {
        progressTimer.current = setInterval(() => {
          const elapsed = Date.now() - startTime.current;
          const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
          setProgress(remaining);
        }, 16);

        closeTimer.current = setTimeout(() => {
          triggerClose();
        }, duration);
      }
    } else if (visible) {
      triggerClose();
    }

    return () => clearTimers();
  }, [open, duration]);

  function clearTimers() {
    clearTimeout(closeTimer.current);
    clearInterval(progressTimer.current);
  }

  function triggerClose() {
    clearTimers();
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      onClose?.();
    }, 380);
  }

  if (!visible) {
    return null;
  }

  const enterTransform = getEnterTransform(position);
  const isCentered = position.includes('center');
  const positionClasses = getPositionClasses(position);

  const containerStyle = {
    opacity: exiting ? 0 : 1,
    transform: exiting
      ? enterTransform
      : isCentered
        ? 'translate(-50%, 0)'
        : 'translate(0, 0)',
    transition: exiting
      ? 'opacity 0.35s cubic-bezier(0.4,0,1,1), transform 0.35s cubic-bezier(0.4,0,1,1)'
      : 'opacity 0.38s cubic-bezier(0,0,0.2,1), transform 0.38s cubic-bezier(0,0,0.2,1)',
  };

  return (
    <div className={`pointer-events-none fixed z-[9999] flex flex-col ${positionClasses}`}>
      <div
        aria-live="assertive"
        aria-atomic="true"
        onClick={onClick}
        className={`pointer-events-auto relative w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-red-200/80 bg-white/90 ring-1 ring-red-100 backdrop-blur-xl ${onClick ? 'cursor-pointer' : ''}`}
        role={onClick ? 'button' : 'alert'}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        } : undefined}
        aria-label={onClick ? title : undefined}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
        }}
        style={{
          ...containerStyle,
          boxShadow: '0 10px 36px rgba(0,0,0,0.12), 0 4px 18px rgba(239,68,68,0.16)',
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.7), transparent)',
          }}
        />

        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(248,113,113,0.22) 0%, transparent 70%)',
          }}
        />

        <div className="relative flex items-start gap-3 px-3.5 pb-3.5 pt-4 sm:gap-3.5 sm:px-4">
          <div className="mt-0.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-200/70 bg-gradient-to-br from-red-50 to-rose-50 shadow-sm">
              <WarningIcon />
            </div>
          </div>

          <div className="min-w-0 flex-1 pt-0.5 text-center sm:text-start">
            {title ? (
              <p
                className="text-sm font-semibold leading-snug tracking-tight text-gray-900"
                style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif" }}
              >
                {title}
              </p>
            ) : null}
            {message ? (
              <p
                className="mt-0.5 text-[0.8rem] leading-relaxed text-gray-500"
                style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif" }}
              >
                {message}
              </p>
            ) : null}
          </div>

          {onClose ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                triggerClose();
              }}
              aria-label="Dismiss warning"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-all duration-150 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        {duration > 0 ? (
          <div className="relative h-[3px] w-full overflow-hidden bg-red-50">
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #ef4444, #f43f5e)',
                transition: 'width 0.1s linear',
                boxShadow: '0 0 6px rgba(239,68,68,0.45)',
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
