/**
 * useCityTwinTerrain — swap the viewer's terrain provider for the city
 * twin's quantized-mesh terrain produced by the conversion pipeline.
 *
 * Mirrors the mesh effect's lifecycle in LiveCityViewer (Resource +
 * bearer header + cancellation flag + status updates), the difference
 * being that terrain providers are assigned directly to
 * `viewer.terrainProvider` rather than added as primitives.
 *
 * Visibility off OR no URL → restore EllipsoidTerrainProvider (flat globe).
 * Opacity is not honoured here — the Cesium terrain provider has no
 * concept of alpha; the slider in the panel is intentionally disabled
 * for the terrain row.
 */

import { useEffect } from "react";
import {
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  Resource,
  type Viewer as CesiumViewer,
} from "cesium";
import { absolutizeProxiedUrl, bearerHeader } from "@/lib/citytwin/proxy";
import { useCityTwinViewerStore } from "@/store/cityTwinViewerStore";

export function useCityTwinTerrain(
  viewer: CesiumViewer | null,
  terrainUrl: string | null | undefined,
): void {
  const visible = useCityTwinViewerStore((s) => s.layers.terrain.visible);
  const setStatus = useCityTwinViewerStore((s) => s.setStatus);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const absolute = absolutizeProxiedUrl(terrainUrl);

    // Cesium's only API for swapping terrain is mutating
    // `viewer.terrainProvider`. The react-hooks/immutability rule (React
    // Compiler) treats this as forbidden hook-argument mutation, so we
    // suppress the rule for each Cesium assignment below — there is no
    // alternative imperative API.

    // No terrain URL or layer toggled off → flat globe.
    if (!absolute || !visible) {
      // eslint-disable-next-line react-hooks/immutability
      viewer.terrainProvider = new EllipsoidTerrainProvider();
      viewer.scene.requestRender();
      setStatus("terrain", "idle");
      return;
    }

    let cancelled = false;
    setStatus("terrain", "loading");

    (async () => {
      try {
        const resource = new Resource({
          url: absolute,
          headers: bearerHeader(),
        });
        const provider = await CesiumTerrainProvider.fromUrl(resource, {
          requestVertexNormals: true,
        });
        if (cancelled || viewer.isDestroyed()) return;
        viewer.terrainProvider = provider;
        viewer.scene.requestRender();
        setStatus("terrain", "ready");
      } catch (err) {
        console.error("[CityTwin] terrain load failed", err);
        if (cancelled || viewer.isDestroyed()) return;
        // Reset to flat globe so the user isn't stuck on a half-loaded mesh
        // if the proxy 401s or layer.json is malformed.
        viewer.terrainProvider = new EllipsoidTerrainProvider();
        viewer.scene.requestRender();
        setStatus(
          "terrain",
          "error",
          err instanceof Error ? err.message : String(err),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewer, terrainUrl, visible, setStatus]);
}
