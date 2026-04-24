'use client';

/**
 * V-TASK-03 — Renders the design overlay GeoJSON as a Cesium GeoJsonDataSource
 * with a dashed stroke so operators can compare as-built terrain against a
 * design surface. Visibility is controlled by the 'design_overlay' layer entry.
 *
 * The hook owns the DataSource lifecycle: it creates one source on mount,
 * loads new GeoJSON whenever the store updates, and removes the source on
 * unmount. It does not conflict with the measurement datasource because
 * Cesium's dataSources collection is additive.
 */
import { useEffect, useRef } from 'react';
import type { Viewer as CesiumViewer, GeoJsonDataSource } from 'cesium';
import { useViewerStore } from '@/store/viewerStore';

export function useDesignOverlayLayer(viewerRef: React.RefObject<CesiumViewer | null>) {
  const designOverlayGeoJSON = useViewerStore((s) => s.designOverlayGeoJSON);
  const isVisible = useViewerStore((s) => s.layers['design_overlay']?.visible ?? false);
  const dsRef = useRef<GeoJsonDataSource | null>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Lazy-import Cesium to avoid breaking SSR
    import('cesium').then(({ GeoJsonDataSource, Color }) => {
      // Remove any previous datasource
      if (dsRef.current) {
        viewer.dataSources.remove(dsRef.current, true);
        dsRef.current = null;
      }

      if (!designOverlayGeoJSON || !isVisible) return;

      const ds = new GeoJsonDataSource('design_overlay');
      ds.load(designOverlayGeoJSON as object, {
        stroke: Color.YELLOW,
        strokeWidth: 2,
        fill: Color.YELLOW.withAlpha(0.15),
        clampToGround: true,
      }).then(() => {
        if (viewer.isDestroyed()) return;
        viewer.dataSources.add(ds);
        dsRef.current = ds;
      }).catch(() => {
        // Malformed GeoJSON — silently skip (user gets toast from uploader)
      });
    });
  }, [viewerRef, designOverlayGeoJSON, isVisible]);

  // Remove datasource on unmount
  useEffect(() => {
    return () => {
      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed() && dsRef.current) {
        viewer.dataSources.remove(dsRef.current, true);
        dsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
