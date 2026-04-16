/**
 * Bottom status bar showing real-time cursor position (lat/lng, elevation)
 * and camera altitude. Updates on mouse move via the store.
 */
'use client';

import React from 'react';
import { useViewerStore } from '../../store/viewerStore';
import { Badge } from '../ui/badge';

export const CoordinatesBar: React.FC = () => {
  const cursor = useViewerStore((s) => s.cursorPosition);
  const cameraHeight = useViewerStore((s) => s.cameraState.height);
  const manifest = useViewerStore((s) => s.manifest);

  const crs = manifest?.processingCrs || 'WGS 84';
  const vdatum = manifest?.verticalDatum || 'Ellipsoid';

  const formatCoord = (val: number, digits = 6) => val.toFixed(digits);
  const formatAlt = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex select-none items-center justify-between gap-4 border-t bg-background/90 px-4 py-2 text-[10px] font-mono text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex items-center gap-4">
        {cursor ? (
          <>
            <span>
              Lat <strong className="text-foreground">{formatCoord(cursor.lat)}</strong>
            </span>
            <span>
              Lng <strong className="text-foreground">{formatCoord(cursor.lng)}</strong>
            </span>
            <span>
              Elev <span className="text-muted-foreground">({vdatum})</span>{' '}
              <strong className="text-foreground">
                {cursor.elevation !== null ? `${cursor.elevation.toFixed(1)} m` : '--'}
              </strong>
            </span>
          </>
        ) : (
          <span>Hover over the map</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span>
          Camera{' '}
          <strong className="text-foreground">{formatAlt(cameraHeight)}</strong>
        </span>
        <Badge variant="outline" className="font-mono">
          {crs}
        </Badge>
      </div>
    </div>
  );
};
