/**
 * Compass rose that rotates with the camera heading.
 * Click to reset the view to north-up.
 */
'use client';

import React from 'react';
import { useViewerStore } from '@/store/viewerStore';

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
      className="w-10 h-10 rounded-full bg-bg-surface/90 supports-[backdrop-filter]:bg-bg-surface/75 backdrop-blur-md border border-border-subtle shadow-2xl grid place-items-center hover:border-accent/60 transition-colors"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ transform: `rotate(${rotationDeg}deg)`, transition: 'transform 0.15s ease-out' }}
      >
        {/* North pointer (accent amber) */}
        <polygon points="12,2 14.5,12 12,10.5 9.5,12" fill="var(--color-accent)" />
        {/* South pointer (muted) */}
        <polygon
          points="12,22 14.5,12 12,13.5 9.5,12"
          fill="currentColor"
          className="text-text-muted"
        />
        {/* Center dot */}
        <circle cx="12" cy="12" r="1.5" fill="currentColor" className="text-text-secondary" />
        {/* N label */}
        <text
          x="12"
          y="7.5"
          textAnchor="middle"
          fontSize="5"
          fontWeight="bold"
          fill="var(--color-accent)"
          style={{ transform: `rotate(${-rotationDeg}deg)`, transformOrigin: '12px 12px' }}
        >
          N
        </text>
      </svg>
    </button>
  );
};
