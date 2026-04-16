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

  const btnClass =
    'grid h-8 w-8 place-items-center text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background/95 p-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <button type="button" onClick={onZoomIn} title="Zoom in" className={btnClass}>
        <Plus className="size-4" />
      </button>
      <div className="h-px bg-border" />
      <button type="button" onClick={onZoomOut} title="Zoom out" className={btnClass}>
        <Minus className="size-4" />
      </button>
      <div className="h-px bg-border" />
      <button type="button" onClick={onFitBounds} title="Fit to site" className={btnClass}>
        <Maximize2 className="size-3.5" />
      </button>
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={onToggle3D}
        title={is3D ? 'Switch to 2D' : 'Switch to 3D'}
        className={btnClass}
      >
        {is3D ? <Square className="size-3.5" /> : <Box className="size-3.5" />}
      </button>
      <div className="h-px bg-border" />
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className={btnClass}
      >
        {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
      </button>
    </div>
  );
};
