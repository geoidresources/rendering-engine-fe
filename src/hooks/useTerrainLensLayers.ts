'use client';

/**
 * useTerrainLensLayers — Virtual Surveyor parity (Phase 0)
 *
 * Wires the three terrain-lens XYZ tile pyramids (slope / aspect / flow)
 * onto the Cesium globe as `UrlTemplateImageryProvider` layers.
 *
 * Survey-switch safety: each effect run tracks the URL used to build the
 * current imagery layer. When `lensTiles` changes (new survey loaded),
 * the URL comparison detects the stale layer and tears it down before
 * building the replacement — preventing the old survey's gradient from
 * persisting after the timeline switch.
 *
 * Layer ordering: the lens is raised to the top of the Cesium imagery
 * stack after creation so it always renders above the ortho. The
 * `raiseToTop` call is repeated on each effect cycle because ortho or
 * heatmap layers added later could push the lens back down.
 *
 * CORS: GCS URLs are rewritten through the rendering-engine-be asset
 * proxy (`/api/v1/assets/proxy/...`) so Cesium's WebGL texture uploader
 * receives the CORS headers it needs. Direct GCS fetches are blocked by
 * the browser's same-origin policy.
 */

import { useEffect, useRef } from 'react';
import type { ImageryLayer, Viewer as CesiumViewer } from 'cesium';
import { Rectangle, UrlTemplateImageryProvider } from 'cesium';
import { useViewerStore, type LayerId } from '@/store/viewerStore';
import { rewriteGcsUrl } from '@/lib/assetUrl';
import type { TerrainLensTiles } from '@/types/manifest';

type LensKey = Extract<LayerId, 'lens_slope' | 'lens_aspect' | 'lens_flow'>;
const LENS_KEYS: LensKey[] = ['lens_slope', 'lens_aspect', 'lens_flow'];

function lensTilesFor(
  key: LensKey,
  lenses: { slope?: TerrainLensTiles; aspect?: TerrainLensTiles; flow?: TerrainLensTiles } | undefined,
): TerrainLensTiles | undefined {
  if (!lenses) return undefined;
  if (key === 'lens_slope') return lenses.slope;
  if (key === 'lens_aspect') return lenses.aspect;
  return lenses.flow;
}

export function useTerrainLensLayers(viewerRef: React.RefObject<CesiumViewer | null>) {
  const manifest = useViewerStore((s) => s.manifest);
  const layers = useViewerStore((s) => s.layers);
  const lensTiles = manifest?.terrainLenses;

  // One ImageryLayer ref per lens + the proxied URL that was used to build it.
  // Pairing them lets us detect a survey switch (URL changed) and rebuild
  // without inspecting Cesium internals.
  const slopeRef = useRef<ImageryLayer | null>(null);
  const aspectRef = useRef<ImageryLayer | null>(null);
  const flowRef  = useRef<ImageryLayer | null>(null);

  const slopeUrlRef = useRef<string | null>(null);
  const aspectUrlRef = useRef<string | null>(null);
  const flowUrlRef  = useRef<string | null>(null);

  const refFor    = (key: LensKey) => key === 'lens_slope' ? slopeRef    : key === 'lens_aspect' ? aspectRef    : flowRef;
  const urlRefFor = (key: LensKey) => key === 'lens_slope' ? slopeUrlRef : key === 'lens_aspect' ? aspectUrlRef : flowUrlRef;

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    for (const key of LENS_KEYS) {
      const tiles      = lensTilesFor(key, lensTiles);
      const layerState = layers[key];
      const ref        = refFor(key);
      const urlRef     = urlRefFor(key);

      // ── Teardown path ─────────────────────────────────────────────
      // Condition 1: no tile data for this survey or layer toggled off.
      // Condition 2: survey switched — the tile URL no longer matches
      //   what we built; tear down the stale provider first.
      const targetUrl = tiles?.url ? (rewriteGcsUrl(tiles.url) ?? tiles.url) : null;
      const urlMismatch = ref.current && urlRef.current !== targetUrl;

      if (!targetUrl || !layerState?.visible || urlMismatch) {
        if (ref.current && !viewer.isDestroyed()) {
          viewer.scene.imageryLayers.remove(ref.current);
          ref.current = null;
          urlRef.current = null;
          viewer.scene.requestRender();
        }
        if (!targetUrl || !layerState?.visible) continue;
        // If we got here, urlMismatch was true but targetUrl is set and
        // the layer is visible — fall through to the build path below.
      }

      // ── Build path ────────────────────────────────────────────────
      if (!ref.current && targetUrl) {
        const bbox = tiles!.bbox;
        const rectangle =
          bbox && bbox.length === 4
            ? Rectangle.fromDegrees(bbox[0], bbox[1], bbox[2], bbox[3])
            : manifest?.bounds
              ? Rectangle.fromDegrees(
                  manifest.bounds.west,
                  manifest.bounds.south,
                  manifest.bounds.east,
                  manifest.bounds.north,
                )
              : undefined;

        const provider = new UrlTemplateImageryProvider({
          url: targetUrl,
          minimumLevel: tiles!.minZoom ?? 0,
          maximumLevel: tiles!.maxZoom ?? 22,
          rectangle,
          hasAlphaChannel: true,
        });
        ref.current    = viewer.scene.imageryLayers.addImageryProvider(provider);
        urlRef.current = targetUrl;
        // Raise to top: lens must render above ortho (inserted earlier in
        // the stack). Without this the ortho, added by Viewer.tsx, sits
        // above the lens and completely covers the gradient.
        viewer.scene.imageryLayers.raiseToTop(ref.current);
      }

      // ── Update path ───────────────────────────────────────────────
      if (ref.current) {
        ref.current.show  = true;
        ref.current.alpha = layerState.opacity;
        // Re-raise each cycle: heatmap or other layers added after us
        // could push the lens back down.
        viewer.scene.imageryLayers.raiseToTop(ref.current);
      }
    }

    viewer.scene.requestRender();

    // Cleanup: runs when manifest/lensTiles changes (survey switch) and
    // on component unmount. Removes any lens layers still on the scene.
    return () => {
      const v = viewerRef.current;
      if (!v || v.isDestroyed()) return;
      for (const [r, u] of [
        [slopeRef,  slopeUrlRef],
        [aspectRef, aspectUrlRef],
        [flowRef,   flowUrlRef],
      ] as const) {
        if (r.current) {
          v.scene.imageryLayers.remove(r.current);
          r.current = null;
          u.current = null;
        }
      }
    };
  }, [
    viewerRef,
    manifest,
    lensTiles,
    layers.lens_slope?.visible,
    layers.lens_slope?.opacity,
    layers.lens_aspect?.visible,
    layers.lens_aspect?.opacity,
    layers.lens_flow?.visible,
    layers.lens_flow?.opacity,
  ]);

  // Post-manifest ordering fix: when the manifest changes (survey switch),
  // React fires effects in registration order. The lens hook is registered
  // BEFORE Viewer.tsx's ortho/heatmap effects, so those run after the lens
  // and push the lens back down in the stack.
  //
  // The fix: schedule a requestAnimationFrame that fires AFTER all
  // synchronous effects for this render cycle have completed. By then the
  // ortho is already re-added, and we can safely raise the lens to the top.
  // One RAF per survey switch (not per frame) — cheap and deterministic.
  useEffect(() => {
    let rafId: number | null = null;

    rafId = requestAnimationFrame(() => {
      const v = viewerRef.current;
      if (!v || v.isDestroyed()) return;
      const imgLayers = v.scene.imageryLayers;
      for (const ref of [slopeRef, aspectRef, flowRef]) {
        if (ref.current && ref.current.show) {
          imgLayers.raiseToTop(ref.current);
        }
      }
      v.scene.requestRender();
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, lensTiles]);
}
