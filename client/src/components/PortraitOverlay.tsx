import { useState, useEffect } from 'react';

function isPortraitMobile() {
  if (typeof window === 'undefined') return false;
  const portrait = window.innerHeight > window.innerWidth;
  const mobile = Math.min(window.innerWidth, window.innerHeight) < 900;
  return portrait && mobile;
}

export function PortraitOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => setShow(isPortraitMobile());
    check();
    window.addEventListener('resize', check);
    window.screen?.orientation?.addEventListener?.('change', check);
    return () => {
      window.removeEventListener('resize', check);
      window.screen?.orientation?.removeEventListener?.('change', check);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)]">
      <div className="absolute inset-0 felt-surface opacity-[0.08] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-6 px-8 text-center">
        {/* Logo */}
        <img
          src="/android-chrome-192x192.png"
          alt="PokerUrMemory"
          draggable={false}
          className="w-24 h-24 rounded-[22px] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        />

        {/* Brand name */}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide" style={{ color: 'var(--color-blue)' }}>
            PokerUrMemory
          </h1>
        </div>

        {/* Animated phone-rotate icon */}
        <div className="pum-phone-rotate my-2">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Phone body */}
            <rect x="20" y="8" width="24" height="40" rx="4" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            {/* Home button */}
            <circle cx="32" cy="43" r="2.5" fill="white" opacity="0.7" />
            {/* Screen */}
            <rect x="23" y="13" width="18" height="24" rx="2" fill="white" opacity="0.15" />
            {/* Rotation arrows */}
            <path
              d="M8 24 C8 14 16 8 26 8"
              stroke="rgba(212,168,67,0.9)" strokeWidth="2.5" strokeLinecap="round" fill="none"
            />
            <polygon points="24,4 30,8 24,12" fill="rgba(212,168,67,0.9)" />
            <path
              d="M56 40 C56 50 48 56 38 56"
              stroke="rgba(212,168,67,0.9)" strokeWidth="2.5" strokeLinecap="round" fill="none"
            />
            <polygon points="40,60 34,56 40,52" fill="rgba(212,168,67,0.9)" />
          </svg>
        </div>

        {/* Message */}
        <p className="font-display text-xs uppercase tracking-[0.2em] text-white/60 leading-relaxed max-w-[200px]">
          Rotate your device to landscape mode to play
        </p>
      </div>
    </div>
  );
}
