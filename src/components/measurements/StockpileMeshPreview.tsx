"use client";

// Phase 1: extruded-polygon preview (polygon footprint + volumetric mean height)
// Phase 2: real DSM-clipped GLB mesh loaded via CesiumModel.fromGltfAsync.
//          When item.mesh_url is set, Phase 2 takes over; Phase 1 is the fallback
//          for piles whose mesh has not been generated yet.

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["CESIUM_BASE_URL"] =
    typeof CESIUM_BASE_URL !== "undefined" ? CESIUM_BASE_URL : "/cesiumStatic";
}

import { useEffect, useRef } from "react";
import {
  Ion,
  Viewer as CesiumViewer,
  UrlTemplateImageryProvider,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  Rectangle,
  Math as CesiumMath,
  PolygonHierarchy,
  ImageryLayer,
  Model as CesiumModel,
  HeadingPitchRange,
} from "cesium";
import type { MeasurementInventoryItem } from "@/types/api";

Ion.defaultAccessToken = "";

interface Props {
  item: MeasurementInventoryItem | null;
}

/**
 * Deterministic per-material colour. Falls back to amber when the
 * material is null or not in the known list so unclassified piles
 * still render (just uncoloured by type).
 */
function materialColor(material: string | null | undefined): Color {
  switch ((material ?? "").toLowerCase()) {
    case "iron_ore":
    case "iron ore":
      return Color.fromCssColorString("#c2410c");
    case "coal":
      return Color.fromCssColorString("#1f2937");
    case "limestone":
      return Color.fromCssColorString("#e7e5e4");
    case "copper":
    case "copper_ore":
      return Color.fromCssColorString("#b45309");
    case "gold":
    case "gold_ore":
      return Color.fromCssColorString("#ca8a04");
    case "bauxite":
      return Color.fromCssColorString("#9a3412");
    case "sand":
      return Color.fromCssColorString("#d4a574");
    case "gravel":
      return Color.fromCssColorString("#78716c");
    default:
      return Color.fromCssColorString("#eab308");
  }
}

/**
 * Parse a GeoJSON Polygon or MultiPolygon string and return its
 * outer-ring coordinates as a flat [lng,lat,lng,lat,…] array plus the
 * min/max bbox. Returns null on any parse failure so the caller can
 * render an empty-state instead of throwing.
 */
function parsePolygon(
  geojson: string,
): { flat: number[]; bbox: [number, number, number, number] } | null {
  try {
    const g = JSON.parse(geojson) as {
      type: string;
      coordinates: unknown;
    };
    let ring: number[][] | null = null;
    if (g.type === "Polygon") {
      ring = (g.coordinates as number[][][])[0] ?? null;
    } else if (g.type === "MultiPolygon") {
      ring = (g.coordinates as number[][][][])[0]?.[0] ?? null;
    }
    if (!ring || ring.length < 3) return null;

    const flat: number[] = [];
    let west = Infinity,
      south = Infinity,
      east = -Infinity,
      north = -Infinity;
    for (const [lng, lat] of ring) {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      flat.push(lng, lat);
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    if (flat.length < 6) return null;
    return { flat, bbox: [west, south, east, north] };
  } catch {
    return null;
  }
}

export default function StockpileMeshPreview({ item }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  // Phase 1: entity-based extruded polygon
  const entityIdRef = useRef<string | null>(null);
  // Phase 2: CesiumModel primitive loaded from GLB
  const modelPrimitiveRef = useRef<CesiumModel | null>(null);

  // Instantiate the viewer once. All UI widgets are disabled — this is
  // a display-only surface; interaction happens through the inventory table.
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const creditContainer = document.createElement("div");
    creditContainer.style.display = "none";

    const viewer = new CesiumViewer(containerRef.current, {
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      selectionIndicator: false,
      infoBox: false,
      baseLayer: false as unknown as ImageryLayer,
      requestRenderMode: true,
      creditContainer,
    });

    viewer.scene.globe.baseColor = Color.fromCssColorString("#1a1a2e");
    viewer.scene.skyAtmosphere && (viewer.scene.skyAtmosphere.show = false);
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.globe.enableLighting = false;

    const provider = new UrlTemplateImageryProvider({
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      subdomains: "abcd",
      minimumLevel: 0,
      maximumLevel: 19,
      credit: "CartoDB",
    });
    viewer.scene.imageryLayers.addImageryProvider(provider);

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
      entityIdRef.current = null;
      modelPrimitiveRef.current = null;
    };
  }, []);

  // Swap geometry whenever `item` changes. Phase 2 (GLB) is preferred;
  // Phase 1 (extruded polygon) runs when mesh_url is absent or load fails.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // --- Cleanup previous geometry ---
    if (entityIdRef.current) {
      const prev = viewer.entities.getById(entityIdRef.current);
      if (prev) viewer.entities.remove(prev);
      entityIdRef.current = null;
    }
    if (modelPrimitiveRef.current) {
      if (!modelPrimitiveRef.current.isDestroyed())
        viewer.scene.primitives.remove(modelPrimitiveRef.current);
      modelPrimitiveRef.current = null;
    }

    if (!item) return;

    // Helper: Phase 1 extruded-polygon fallback
    const loadExtrudedPolygon = () => {
      const parsed = parsePolygon(item.geojson);
      if (!parsed) return;

      const height =
        item.volume_m3 != null && item.area_m2 != null && item.area_m2 > 0
          ? item.volume_m3 / item.area_m2
          : 0;

      const positions = Cartesian3.fromDegreesArray(parsed.flat);
      const fill = materialColor(item.material_type);

      const entity = viewer.entities.add({
        id: `stockpile-${item.id}`,
        polygon: {
          hierarchy: new PolygonHierarchy(positions),
          extrudedHeight: height,
          material: new ColorMaterialProperty(fill.withAlpha(0.9)),
          outline: true,
          outlineColor: Color.WHITE.withAlpha(0.8),
        },
      });
      entityIdRef.current = entity.id;

      const [w, s, e, n] = parsed.bbox;
      const padLng = Math.max(0.00005, (e - w) * 0.25);
      const padLat = Math.max(0.00005, (n - s) * 0.25);
      viewer.camera.flyTo({
        destination: Rectangle.fromDegrees(
          w - padLng,
          s - padLat,
          e + padLng,
          n + padLat,
        ),
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-35),
          roll: 0,
        },
        duration: 0.8,
      });
    };

    // --- Phase 2: real GLB mesh ---
    if (item.mesh_url) {
      let cancelled = false;

      CesiumModel.fromGltfAsync({ url: item.mesh_url })
        .then((model) => {
          if (cancelled || !viewerRef.current || viewerRef.current.isDestroyed()) {
            model.destroy();
            return;
          }
          const v = viewerRef.current;
          v.scene.primitives.add(model);
          modelPrimitiveRef.current = model;
          v.scene.requestRender();

          // Fly to the model bounding sphere once the GPU is ready
          model.readyEvent.addEventListener(() => {
            if (cancelled || !viewerRef.current || viewerRef.current.isDestroyed()) return;
            viewerRef.current.camera.flyToBoundingSphere(model.boundingSphere, {
              offset: new HeadingPitchRange(0, CesiumMath.toRadians(-35), 0),
              duration: 0.8,
            });
            viewerRef.current.scene.requestRender();
          });
        })
        .catch((err) => {
          if (cancelled) return;
          console.warn("[StockpileMeshPreview] GLB load failed, using extrusion fallback", err);
          loadExtrudedPolygon();
        });

      return () => {
        cancelled = true;
      };
    }

    // --- Phase 1 fallback: extruded polygon ---
    loadExtrudedPolygon();
  }, [item]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-bg-elevated"
      style={{ minHeight: 240 }}
    />
  );
}
