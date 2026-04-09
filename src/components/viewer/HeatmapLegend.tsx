/**
 * Color ramp legend for the cut/fill heatmap overlay.
 * Shows gradient from red (cut/excavation) through white (no change) to blue (fill).
 */
'use client';

import React from 'react';
import { useViewerStore } from '../../store/viewerStore';

export const HeatmapLegend: React.FC = () => {
  const visible = useViewerStore((s) => s.layers.heatmap.visible);
  const manifest = useViewerStore((s) => s.manifest);

  if (!visible) return null;

  // Read z-range from heatmap asset if available (e.g., [-5, 5] for -5m cut to +5m fill)
  const heatmapAsset = manifest?.assets?.find((a) => a.assetType === 'heatmap');
  const zRange = heatmapAsset?.zRange;
  const minLabel = zRange ? `${zRange[0].toFixed(1)}m` : 'Cut';
  const maxLabel = zRange ? `+${zRange[1].toFixed(1)}m` : 'Fill';
  const midLabel = '0';

  return (
    <div className="absolute bottom-10 left-4 z-10 flex flex-col gap-1 rounded-xl bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/70 shadow-lg shadow-black/10 dark:shadow-black/30 p-3 w-40">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Cut / Fill
      </span>
      <div
        className="h-3 rounded-sm"
        style={{
          background: 'linear-gradient(to right, #ef4444, #fca5a5, #ffffff, #93c5fd, #3b82f6)',
        }}
      />
      <div className="flex justify-between text-[9px] font-mono text-zinc-500 dark:text-zinc-400">
        <span>{minLabel}</span>
        <span>{midLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
};
