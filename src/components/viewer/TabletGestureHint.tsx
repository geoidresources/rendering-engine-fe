'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'viewer:tablet-hint-seen';

/**
 * V-MOBILE-01 — Gesture hint overlay shown once on the first tablet visit.
 * Dismissed after 4 s or on tap; then stored to localStorage so it doesn't
 * reappear. Only mounts when the pointer is `coarse` (touch device).
 */
export function TabletGestureHint() {
  // Null = haven't checked browser APIs yet (SSR + first client paint).
  // Once the mount effect runs we know whether to reveal.
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const seen = !!localStorage.getItem(STORAGE_KEY);
    if (!coarse || seen) return;
    const reveal = requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      localStorage.setItem(STORAGE_KEY, '1');
    }, 4000);
    return () => {
      cancelAnimationFrame(reveal);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-50 pointer-events-auto flex items-center justify-center"
      onClick={dismiss}
    >
      <div className="rounded-xl border border-border-subtle bg-bg-surface/90 backdrop-blur-md px-6 py-5 text-center max-w-xs shadow-2xl">
        <p className="text-[13px] font-semibold text-text-primary mb-2">Touchscreen controls</p>
        <ul className="text-[11px] text-text-muted space-y-1 text-left list-none">
          <li>✦ Pinch to zoom in/out</li>
          <li>✦ Two-finger drag to pan</li>
          <li>✦ Single tap to select</li>
          <li>✦ Swipe up from bottom to open tools</li>
        </ul>
        <p className="text-[10px] text-text-muted mt-3">Tap anywhere to dismiss</p>
      </div>
    </div>
  );
}
