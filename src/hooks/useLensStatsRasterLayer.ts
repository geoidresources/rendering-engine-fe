'use client';

/**
 * useLensStatsRasterLayer — renders the polygon-clipped slope / aspect
 * / flow PNG (returned by /compute/lens-stats with `include_rasters:true`)
 * as a Cesium imagery layer over the polygon's bounding box.
 *
 * The PNGs are pre-masked to the polygon shape (transparent outside),
 * so the layer visually appears inside the polygon only — even though
 * the Cesium imagery rectangle is a bounding box.
 *
 * Lifecycle:
 *   * `lensStats.result` changes → tear down the previous provider so
 *     a polygon swap doesn't leave the old gradient floating in the
 *     scene.
 *   * `lensStats.rasterChoice` changes → swap which lens PNG is shown
 *     (null hides the overlay entirely).
 *   * Always raise the imagery layer to the top of the stack via
 *     `requestAnimationFrame` so it sits above the ortho once that
 *     effect settles after a survey reload.
 *
 * Layer identity is held in a single ref because the radio in the
 * LensStatsSubView enforces "at most one raster active at a time" —
 * there's no need for three parallel refs.
 */

import { useEffect, useRef } from 'react';
import type { ImageryLayer, Viewer as CesiumViewer } from 'cesium';
import { Rectangle, SingleTileImageryProvider } from 'cesium';
import { useViewerStore } from '@/store/viewerStore';

export function useLensStatsRasterLayer(viewerRef: React.RefObject<CesiumViewer | null>) {
  const lensStats = useViewerStore((s) => s.lensStats);
  const layerRef = useRef<ImageryLayer | null>(null);
  // Track which PNG was used to build the current provider. SingleTile
  // providers are constructed with the image baked in; switching radios
  // means tearing down + rebuilding. The ref lets us short-circuit
  // re-renders that don't actually change the displayed image.
  const builtForKey = useRef<string | null>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const { result, rasterChoice } = lensStats;
    const pngB64 =
      rasterChoice === 'slope'
        ? result?.slope_png_b64
        : rasterChoice === 'aspect'
          ? result?.aspect_png_b64
          : rasterChoice === 'flow'
            ? result?.flow_png_b64
            : undefined;

    // Compose the cache key from raster_bbox + raster choice + computed_at
    // so re-renders that don't change the underlying PNG are cheap.
    const targetKey = pngB64 && result?.raster_bbox
      ? `${result.computed_at}|${rasterChoice}|${result.raster_bbox.join(',')}`
      : null;

    if (!targetKey) {
      // Nothing to render — clear the existing layer.
      if (layerRef.current) {
        viewer.scene.imageryLayers.remove(layerRef.current);
        layerRef.current = null;
        builtForKey.current = null;
        viewer.scene.requestRender();
      }
      return;
    }

    if (builtForKey.current === targetKey && layerRef.current) {
      // Same image as last render; nothing to do.
      return;
    }

    // Tear down the previous layer (different polygon or different lens).
    if (layerRef.current) {
      viewer.scene.imageryLayers.remove(layerRef.current);
      layerRef.current = null;
    }

    const bbox = result!.raster_bbox!;
    const rect = Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3]);

    // SingleTileImageryProvider accepts an async `fromUrl` factory in
    // modern Cesium. The data: URI lets us avoid GCS / proxy fetches —
    // the PNG bytes are already in memory from the JSON response.
    SingleTileImageryProvider.fromUrl(`data:image/png;base64,${pngB64}`, {
      rectangle: rect,
    })
      .then((provider) => {
        if (viewer.isDestroyed()) return;
        const layer = viewer.scene.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.85;
        layerRef.current = layer;
        builtForKey.current = targetKey;
        // Raise to top after layer addition; like the lens-tile layers,
        // ortho is added later and would otherwise cover the raster.
        viewer.scene.imageryLayers.raiseToTop(layer);
        viewer.scene.requestRender();
      })
      .catch(() => {
        // Fail quiet — the FE card already shows numeric stats; an
        // overlay failure shouldn't break the card.
      });
  }, [
    viewerRef,
    lensStats.result,
    lensStats.rasterChoice,
  ]);

  // Persistent raise-to-top: ensure the raster stays above ortho even
  // after manifest changes re-add imagery underneath. The lens-tile
  // hook uses the same pattern; we share the philosophy here.
  useEffect(() => {
    let raf: number | null = null;
    raf = requestAnimationFrame(() => {
      const v = viewerRef.current;
      if (!v || v.isDestroyed() || !layerRef.current) return;
      if (layerRef.current.show) {
        v.scene.imageryLayers.raiseToTop(layerRef.current);
        v.scene.requestRender();
      }
    });
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [viewerRef, lensStats.result, lensStats.rasterChoice]);
}
