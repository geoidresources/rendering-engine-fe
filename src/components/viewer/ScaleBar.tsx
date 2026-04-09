/**
 * Dynamic map scale bar. Computes ground distance from camera height
 * and picks an appropriate round-number label (1m, 5m, 10m, ... 100km).
 */
'use client';

import React, { useMemo } from 'react';
import { useViewerStore } from '../../store/viewerStore';

/** Round scale stops in metres. */
const STOPS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000,
];

function formatScaleLabel(meters: number): string {
  if (meters >= 1000) return `${meters / 1000} km`;
  return `${meters} m`;
}

export const ScaleBar: React.FC = () => {
  const cameraHeight = useViewerStore((s) => s.cameraState.height);

  const { label, widthPx } = useMemo(() => {
    // Approximate ground resolution: at a given camera height, how many meters per pixel?
    // Cesium's default perspective frustum FOV is 60 degrees (Math.PI / 3).
    // FOV factor = 2 * tan(FOV/2) = 2 * tan(30°) ≈ 1.155.
    // If the actual viewer FOV differs (rare), this would need to be sourced
    // from a viewerRef; 60° is Cesium's documented default.
    const FOV_FACTOR = 1.155; // 2 * Math.tan(Math.PI / 6)
    const canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const groundWidth = FOV_FACTOR * cameraHeight;
    const metersPerPx = groundWidth / canvasWidth;

    // We want a bar that's roughly 100-200px wide
    const targetMeters = metersPerPx * 150;

    // Find the nearest "nice" stop
    let bestStop = STOPS[0];
    for (const stop of STOPS) {
      bestStop = stop;
      if (stop >= targetMeters) break;
    }

    const barPx = Math.round(bestStop / metersPerPx);
    // Clamp bar width to a reasonable range
    const clampedPx = Math.max(40, Math.min(220, barPx));

    return { label: formatScaleLabel(bestStop), widthPx: clampedPx };
  }, [cameraHeight]);

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 leading-none">
        {label}
      </span>
      <div
        className="h-1 bg-zinc-700 dark:bg-zinc-300 rounded-sm"
        style={{ width: `${widthPx}px` }}
      />
    </div>
  );
};
