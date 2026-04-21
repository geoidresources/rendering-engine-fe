/**
 * Color ramp legend for the cut/fill heatmap overlay.
 * Shows gradient from red (cut/excavation) through white (no change) to blue (fill).
 */
'use client';

import React from 'react';
import FloatingPanel from '@/components/ui/FloatingPanel';
import { useViewerStore } from '@/store/viewerStore';

export const HeatmapLegend: React.FC = () => {
  const visible = useViewerStore((s) => s.layers.heatmap.visible);
  const manifest = useViewerStore((s) => s.manifest);

  if (!visible) return null;

  const heatmapAsset = manifest?.assets?.find((a) => a.assetType === 'heatmap');
  const zRange = heatmapAsset?.zRange;
  const minLabel = zRange ? `${zRange[0].toFixed(1)}m` : 'Cut';
  const maxLabel = zRange ? `+${zRange[1].toFixed(1)}m` : 'Fill';
  const midLabel = '0';

  return (
    <FloatingPanel
      anchor="bottom-left"
      title="Cut / Fill"
      width={176}
      className="bottom-9"
    >
      <div className="flex flex-col gap-1 px-3 py-2">
        <div
          className="h-3 rounded-sm"
          style={{
            background: 'linear-gradient(to right, #ef4444, #fca5a5, #ffffff, #93c5fd, #3b82f6)',
          }}
        />
        <div
          className="flex justify-between text-[9px] font-mono text-text-muted"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <span>{minLabel}</span>
          <span>{midLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    </FloatingPanel>
  );
};
