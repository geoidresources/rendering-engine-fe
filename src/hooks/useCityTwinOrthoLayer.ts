/**
 * useCityTwinOrthoLayer — XYZ orthophoto pyramid for the city twin.
 *
 * The backend exposes the ortho pyramid at the proxied prefix
 *   /api/v1/city-twins/:slug/ortho
 * with tiles addressable at `{z}/{x}/{y}.png`. We build a Cesium
 * `UrlTemplateImageryProvider` whose `url` is a `Resource` so Cesium's
 * derived-resource machinery forwards our bearer header on every tile
 * fetch (verified against @cesium/engine 23.0.1 — `Resource.createIfNeeded`
 * preserves headers via `getDerivedResource`).
 *
 * Lifecycle:
 *   - URL present + visible → add an ImageryLayer, store ref for cleanup.
 *   - URL changes OR visibility flips off → remove the existing layer.
 *   - Opacity changes → set `layer.alpha` without re-creating the layer.
 *
 * If the Resource-templating ever misbehaves on a future Cesium release,
 * the fallback is to pass `url: template` (string) and use Cesium's
 * `Request` interceptor to inject headers — but that interceptor is
 * global and would leak headers to non-twin requests.
 */

import { useEffect, useRef } from "react";
import {
  Resource,
  UrlTemplateImageryProvider,
  type ImageryLayer,
  type Viewer as CesiumViewer,
} from "cesium";
import { absolutizeProxiedUrl, bearerHeader } from "@/lib/citytwin/proxy";
import { useCityTwinViewerStore } from "@/store/cityTwinViewerStore";

export function useCityTwinOrthoLayer(
  viewer: CesiumViewer | null,
  orthoUrl: string | null | undefined,
): void {
  const visible = useCityTwinViewerStore((s) => s.layers.ortho.visible);
  const opacity = useCityTwinViewerStore((s) => s.layers.ortho.opacity);
  const setStatus = useCityTwinViewerStore((s) => s.setStatus);

  const layerRef = useRef<ImageryLayer | null>(null);

  // Lifecycle: create / destroy on URL change.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const absolute = absolutizeProxiedUrl(orthoUrl);
    if (!absolute) {
      setStatus("ortho", "idle");
      return;
    }

    // The proxied path is the directory prefix; append the {z}/{x}/{y}.png
    // template suffix here so Cesium can substitute coordinates.
    const template = absolute.replace(/\/$/, "") + "/{z}/{x}/{y}.png";

    setStatus("ortho", "loading");

    let cancelled = false;
    let provider: UrlTemplateImageryProvider | null = null;
    try {
      provider = new UrlTemplateImageryProvider({
        url: new Resource({
          url: template,
          headers: bearerHeader(),
        }),
        hasAlphaChannel: true,
      });
      const layer = viewer.scene.imageryLayers.addImageryProvider(provider);
      if (cancelled || viewer.isDestroyed()) {
        viewer.scene.imageryLayers.remove(layer);
        return;
      }
      layer.show = visible;
      layer.alpha = opacity;
      layerRef.current = layer;
      viewer.scene.requestRender();
      // UrlTemplateImageryProvider doesn't expose a load-promise — once the
      // layer is attached, ready means "primitive is in the scene"; the
      // first failing tile fetch surfaces in the console rather than here.
      setStatus("ortho", "ready");
    } catch (err) {
      console.error("[CityTwin] ortho layer init failed", err);
      setStatus("ortho", "error", err instanceof Error ? err.message : String(err));
    }

    return () => {
      cancelled = true;
      const layer = layerRef.current;
      if (layer && viewer && !viewer.isDestroyed()) {
        viewer.scene.imageryLayers.remove(layer);
      }
      layerRef.current = null;
    };
    // visible / opacity intentionally NOT in deps — they're applied via
    // the lightweight effects below without tearing down the layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, orthoUrl, setStatus]);

  // Honour visibility flips without re-creating the imagery layer.
  useEffect(() => {
    const layer = layerRef.current;
    if (!viewer || viewer.isDestroyed() || !layer) return;
    layer.show = visible;
    viewer.scene.requestRender();
  }, [viewer, visible]);

  // Honour opacity slider.
  useEffect(() => {
    const layer = layerRef.current;
    if (!viewer || viewer.isDestroyed() || !layer) return;
    layer.alpha = opacity;
    viewer.scene.requestRender();
  }, [viewer, opacity]);
}
