/**
 * Bottom status bar showing real-time cursor position (lat/lng, elevation)
 * and camera altitude. Updates on mouse move via the store.
 */
'use client';

import React from 'react';
import { useViewerStore } from '../../store/viewerStore';

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
    <div className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-between gap-4 px-4 py-1.5 bg-white/70 dark:bg-zinc-950/60 backdrop-blur-md border-t border-zinc-200/70 dark:border-zinc-800/70 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 select-none">
      <div className="flex items-center gap-4">
        {cursor ? (
          <>
            <span>
              Lat <strong className="text-zinc-900 dark:text-zinc-100">{formatCoord(cursor.lat)}</strong>
            </span>
            <span>
              Lng <strong className="text-zinc-900 dark:text-zinc-100">{formatCoord(cursor.lng)}</strong>
            </span>
            <span>
              Elev <span className="text-zinc-400 dark:text-zinc-500">({vdatum})</span>{' '}
              <strong className="text-zinc-900 dark:text-zinc-100">
                {cursor.elevation !== null ? `${cursor.elevation.toFixed(1)} m` : '--'}
              </strong>
            </span>
          </>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">Hover over the map</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span>
          Camera{' '}
          <strong className="text-zinc-900 dark:text-zinc-100">{formatAlt(cameraHeight)}</strong>
        </span>
        <span className="px-1.5 py-0.5 rounded bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400">
          {crs}
        </span>
      </div>
    </div>
  );
};
