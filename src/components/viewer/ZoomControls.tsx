/**
 * Zoom +/-, fit-to-bounds, 2D/3D toggle, and fullscreen controls.
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus, Maximize2, Minimize2, Box, Square } from 'lucide-react';

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitBounds: () => void;
  onToggle3D: () => void;
  is3D: boolean;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitBounds,
  onToggle3D,
  is3D,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const btnBase =
    'w-8 h-8 grid place-items-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 transition-colors';

  return (
    <div className="flex flex-col rounded-xl bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/70 shadow-lg shadow-black/10 dark:shadow-black/30 overflow-hidden">
      <button type="button" onClick={onZoomIn} title="Zoom in" className={btnBase}>
        <Plus className="w-4 h-4" />
      </button>
      <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />
      <button type="button" onClick={onZoomOut} title="Zoom out" className={btnBase}>
        <Minus className="w-4 h-4" />
      </button>
      <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />
      <button type="button" onClick={onFitBounds} title="Fit to site" className={btnBase}>
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
      <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />
      <button
        type="button"
        onClick={onToggle3D}
        title={is3D ? 'Switch to 2D' : 'Switch to 3D'}
        className={btnBase}
      >
        {is3D ? <Square className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
      </button>
      <div className="h-px bg-zinc-200/70 dark:bg-zinc-800/70" />
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className={btnBase}
      >
        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
