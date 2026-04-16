/**
 * Compass rose that rotates with the camera heading.
 * Click to reset the view to north-up.
 */
'use client';

import React from 'react';
import { useViewerStore } from '../../store/viewerStore';

interface CompassWidgetProps {
  onResetNorth: () => void;
}

export const CompassWidget: React.FC<CompassWidgetProps> = ({ onResetNorth }) => {
  const heading = useViewerStore((s) => s.cameraState.heading);

  // Cesium heading is in radians (0 = north, increases clockwise)
  const rotationDeg = -(heading * 180) / Math.PI;

  return (
    <button
      type="button"
      onClick={onResetNorth}
      title="Reset to North"
      aria-label="Reset compass to north"
      className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background/95 p-0 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ transform: `rotate(${rotationDeg}deg)`, transition: 'transform 0.15s ease-out' }}
      >
        {/* North pointer (red) */}
        <polygon points="12,2 14.5,12 12,10.5 9.5,12" fill="#ef4444" />
        {/* South pointer (white/grey) */}
        <polygon
          points="12,22 14.5,12 12,13.5 9.5,12"
          fill="currentColor"
          className="text-zinc-400 dark:text-zinc-500"
        />
        {/* Center dot */}
        <circle cx="12" cy="12" r="1.5" fill="currentColor" className="text-zinc-600 dark:text-zinc-300" />
        {/* N label */}
        <text
          x="12"
          y="7.5"
          textAnchor="middle"
          fontSize="5"
          fontWeight="bold"
          fill="#ef4444"
          style={{ transform: `rotate(${-rotationDeg}deg)`, transformOrigin: '12px 12px' }}
        >
          N
        </text>
      </svg>
    </button>
  );
};
