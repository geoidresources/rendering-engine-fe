/**
 * Zoom +/-, fit-to-bounds, and fullscreen controls.
 * 2D/3D mode lives in ContextBar now (single source of truth).
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus, Maximize2, Minimize2 } from 'lucide-react';

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitBounds: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitBounds,
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
    'w-8 h-8 grid place-items-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors';

  return (
    <div className="flex flex-col rounded-sm bg-bg-surface/90 supports-[backdrop-filter]:bg-bg-surface/75 backdrop-blur-md border border-border-subtle shadow-2xl overflow-hidden">
      <button type="button" onClick={onZoomIn} title="Zoom in" className={btnBase}>
        <Plus className="w-4 h-4" />
      </button>
      <div className="h-px bg-border-subtle" />
      <button type="button" onClick={onZoomOut} title="Zoom out" className={btnBase}>
        <Minus className="w-4 h-4" />
      </button>
      <div className="h-px bg-border-subtle" />
      <button type="button" onClick={onFitBounds} title="Fit to site" className={btnBase}>
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
      <div className="h-px bg-border-subtle" />
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
