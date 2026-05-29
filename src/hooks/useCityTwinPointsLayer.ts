/**
 * useCityTwinPointsLayer — point cloud (3D Tiles) for the city twin.
 *
 * Same Cesium3DTileset.fromUrl pattern as the mesh effect in
 * LiveCityViewer, just with a point-cloud style applied and no flyTo
 * (the mesh effect already framed the camera; flying twice yanks the
 * user mid-pan).
 *
 * Style is a fixed point-size + white colour for now; future phases can
 * key colour off classification or intensity once the conversion pipeline
 * preserves those attributes.
 */

import { useEffect, useRef } from "react";
import {
  Cesium3DTileStyle,
  Cesium3DTileset,
  Resource,
  type Viewer as CesiumViewer,
} from "cesium";
import { absolutizeProxiedUrl, bearerHeader } from "@/lib/citytwin/proxy";
import { useCityTwinViewerStore } from "@/store/cityTwinViewerStore";

export function useCityTwinPointsLayer(
  viewer: CesiumViewer | null,
  pointsUrl: string | null | undefined,
): void {
  const visible = useCityTwinViewerStore((s) => s.layers.points.visible);
  const setStatus = useCityTwinViewerStore((s) => s.setStatus);

  const tilesetRef = useRef<Cesium3DTileset | null>(null);

  // Tileset lifecycle keyed on URL — visibility flips happen via the
  // lightweight effect below without re-fetching tiles.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const absolute = absolutizeProxiedUrl(pointsUrl);
    if (!absolute) {
      setStatus("points", "idle");
      return;
    }

    let cancelled = false;
    let tileset: Cesium3DTileset | null = null;
    setStatus("points", "loading");

    (async () => {
      try {
        const resource = new Resource({
          url: absolute,
          headers: bearerHeader(),
        });
        tileset = await Cesium3DTileset.fromUrl(resource, {
          maximumScreenSpaceError: 8,
          cacheBytes: 256 * 1024 * 1024,
        });
        if (cancelled || viewer.isDestroyed()) {
          tileset.destroy();
          return;
        }
        tileset.style = new Cesium3DTileStyle({
          pointSize: 2.0,
          color: "color('white')",
        });
        tileset.show = visible;
        viewer.scene.primitives.add(tileset);
        tilesetRef.current = tileset;
        viewer.scene.requestRender();
        setStatus("points", "ready");
        // Intentionally NO viewer.flyTo — the mesh effect frames the
        // camera; flying again now would yank the user mid-orbit.
      } catch (err) {
        console.error("[CityTwin] point cloud load failed", err);
        if (cancelled) return;
        setStatus(
          "points",
          "error",
          err instanceof Error ? err.message : String(err),
        );
      }
    })();

    return () => {
      cancelled = true;
      const ts = tilesetRef.current ?? tileset;
      if (ts) {
        if (viewer && !viewer.isDestroyed()) {
          viewer.scene.primitives.remove(ts); // also destroys
        } else {
          ts.destroy();
        }
      }
      tilesetRef.current = null;
    };
    // visible intentionally excluded from deps; handled by the dedicated
    // visibility sub-effect below so a toggle doesn't re-download tiles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, pointsUrl, setStatus]);

  // Honour visibility without re-fetching the tileset.
  useEffect(() => {
    const ts = tilesetRef.current;
    if (!viewer || viewer.isDestroyed() || !ts) return;
    ts.show = visible;
    viewer.scene.requestRender();
  }, [viewer, visible]);
}
