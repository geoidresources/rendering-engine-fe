/**
 * Color ramp legend for the cut/fill heatmap overlay.
 * Shows gradient from red (cut/excavation) through white (no change) to blue (fill).
 */
'use client';

import React from 'react';
import { useViewerStore } from '../../store/viewerStore';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card';

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
    <Card className="absolute bottom-10 left-4 z-10 w-44 border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Cut / Fill
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div
          className="h-3 rounded-sm"
          style={{
            background: 'linear-gradient(to right, #ef4444, #fca5a5, #ffffff, #93c5fd, #3b82f6)',
          }}
        />
        <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
          <span>{minLabel}</span>
          <span>{midLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
};
