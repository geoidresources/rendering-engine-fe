/**
 * useCityTwinVectorLayer — GeoJSON / TopoJSON vector features for the
 * city twin (footprints, road edges, drains, etc., depending on what
 * the conversion produced).
 *
 * `GeoJsonDataSource.load` accepts a Cesium `Resource` directly (verified
 * against @cesium/engine 23.0.1 — see GeoJsonDataSource.js:928), so the
 * bearer header rides along on the fetch.
 */

import { useEffect, useRef } from "react";
import {
  GeoJsonDataSource,
  Resource,
  type Viewer as CesiumViewer,
} from "cesium";
import { absolutizeProxiedUrl, bearerHeader } from "@/lib/citytwin/proxy";
import { useCityTwinViewerStore } from "@/store/cityTwinViewerStore";

export function useCityTwinVectorLayer(
  viewer: CesiumViewer | null,
  vectorUrl: string | null | undefined,
): void {
  const visible = useCityTwinViewerStore((s) => s.layers.vector.visible);
  const setStatus = useCityTwinViewerStore((s) => s.setStatus);

  const dsRef = useRef<GeoJsonDataSource | null>(null);

  // Load / unload keyed on URL only.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const absolute = absolutizeProxiedUrl(vectorUrl);
    if (!absolute) {
      setStatus("vector", "idle");
      return;
    }

    let cancelled = false;
    setStatus("vector", "loading");

    (async () => {
      try {
        const resource = new Resource({
          url: absolute,
          headers: bearerHeader(),
        });
        const ds = await GeoJsonDataSource.load(resource, {
          // Defaults match the digital-twin design tokens — slim dark
          // strokes with translucent fills so footprints sit on top of
          // ortho without drowning it.
          strokeWidth: 1.5,
          clampToGround: true,
        });
        if (cancelled || viewer.isDestroyed()) return;
        viewer.dataSources.add(ds);
        ds.show = visible;
        dsRef.current = ds;
        viewer.scene.requestRender();
        setStatus("vector", "ready");
      } catch (err) {
        console.error("[CityTwin] vector load failed", err);
        if (cancelled) return;
        setStatus(
          "vector",
          "error",
          err instanceof Error ? err.message : String(err),
        );
      }
    })();

    return () => {
      cancelled = true;
      const ds = dsRef.current;
      if (ds && viewer && !viewer.isDestroyed()) {
        viewer.dataSources.remove(ds, true);
      }
      dsRef.current = null;
    };
    // visible excluded — handled below without reloading the GeoJSON.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, vectorUrl, setStatus]);

  // Visibility toggle without re-fetching.
  useEffect(() => {
    const ds = dsRef.current;
    if (!viewer || viewer.isDestroyed() || !ds) return;
    ds.show = visible;
    viewer.scene.requestRender();
  }, [viewer, visible]);
}
