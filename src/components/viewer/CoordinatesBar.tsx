/**
 * Bottom status bar showing real-time cursor position (lat/lng, elevation)
 * and camera altitude. Updates on mouse move via the store.
 */
'use client';

import React from 'react';
import { useViewerStore } from '@/store/viewerStore';

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
    <div
      className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-between gap-4 px-4 py-1.5 bg-bg-base/80 supports-[backdrop-filter]:bg-bg-base/60 backdrop-blur-md border-t border-border-subtle text-[10px] font-mono text-text-muted select-none"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      <div className="flex items-center gap-4">
        {cursor ? (
          <>
            <span>
              LAT <strong className="text-text-primary">{formatCoord(cursor.lat)}</strong>
            </span>
            <span>
              LNG <strong className="text-text-primary">{formatCoord(cursor.lng)}</strong>
            </span>
            <span>
              ELEV <span className="text-text-muted">({vdatum})</span>{' '}
              <strong className="text-text-primary">
                {cursor.elevation !== null ? `${cursor.elevation.toFixed(1)} m` : '--'}
              </strong>
            </span>
          </>
        ) : (
          <span className="text-text-muted uppercase tracking-[0.2em]">Hover the canvas</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span>
          CAMERA <strong className="text-text-primary">{formatAlt(cameraHeight)}</strong>
        </span>
        <span className="px-1.5 py-0.5 rounded-sm bg-bg-surface border border-border-subtle text-text-muted uppercase tracking-[0.15em]">
          {crs}
        </span>
      </div>
    </div>
  );
};
