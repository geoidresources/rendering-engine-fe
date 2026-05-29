'use client';

/**
 * Volume3DPreview — small 3D mesh preview for the right-rail Inspector
 * Volume card.
 *
 * Two-phase rendering, mirroring StockpileMeshPreview on /measurements:
 *
 *   Phase 1 — extruded prism (always renders first). Driven by the
 *             current `meanHeight = netVolume / area`. Lets operators
 *             see a 3D shape immediately while drafting, before any
 *             backend processing has run.
 *   Phase 2 — real GLB mesh, loaded via CesiumModel.fromGltfAsync once
 *             `glbUrl` is supplied. When the operator clicks "Generate
 *             3D Mesh", the card POSTs a stockpile measurement, polls
 *             until `mesh_status === 'complete'`, and feeds the URL
 *             here — at which point Phase 1 is removed and the actual
 *             DSM-clipped mesh takes over.
 */

import { useEffect, useRef } from 'react';
import {
  Cartesian3,
  Color,
  Viewer as CesiumViewer,
  HeadingPitchRange,
  Math as CesiumMath,
  BoundingSphere,
  UrlTemplateImageryProvider,
  ImageryLayer,
  Ion,
  Model as CesiumModel,
} from 'cesium';

import { buildExtrudedStockpileEntity } from '@/lib/cesium/stockpilePreviewPrimitive';
import { materialColor } from '@/lib/cesium/materialColor';
import type { MeasurementPoint } from '@/store/viewerStore';

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>)['CESIUM_BASE_URL'] =
    typeof CESIUM_BASE_URL !== 'undefined' ? CESIUM_BASE_URL : '/cesiumStatic';
}

Ion.defaultAccessToken = '';

interface Props {
  points: MeasurementPoint[];
  /** Volumetric mean height (netVolume / area). */
  meanHeight: number;
  /** Base-plane elevation a.s.l. where the prism's flat bottom sits. */
  baseElevation?: number;
  /** Material — drives prism colour to match the saved-measurement preview. */
  materialType?: string | null;
  /**
   * Optional GCS GLB URL. When provided, the prism is swapped for the
   * real mesh loaded via Cesium's glTF loader. Falsy values keep the
   * Phase-1 prism in place.
   */
  glbUrl?: string | null;
}

export default function Volume3DPreview({
  points,
  meanHeight,
  baseElevation = 0,
  materialType,
  glbUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  // Phase 1: entity-based extruded prism
  const entityIdRef = useRef<string | null>(null);
  // Phase 2: CesiumModel primitive loaded from GLB
  const modelPrimitiveRef = useRef<CesiumModel | null>(null);

  // Instantiate the viewer once. Display-only — no UI widgets, no
  // mouse interaction needed (the main map handles editing).
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const creditContainer = document.createElement('div');
    creditContainer.style.display = 'none';

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

    viewer.scene.globe.baseColor = Color.fromCssColorString('#0a0a0e');
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.globe.enableLighting = false;

    const provider = new UrlTemplateImageryProvider({
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      minimumLevel: 0,
      maximumLevel: 19,
      credit: 'CartoDB',
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

  // Swap geometry whenever inputs change. Phase 2 (GLB) wins when
  // glbUrl is set; Phase 1 (prism) is the fallback.
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

    if (points.length < 3) return;

    const loadPrism = () => {
      const v = viewerRef.current;
      if (!v || v.isDestroyed()) return;

      const safeHeight = Math.max(meanHeight, 0.1);

      // Build base + top vertex rings. Framing the prism uses BOTH so
      // the bounding sphere encloses the full extruded volume —
      // otherwise tall thin piles (e.g. 5 m wide × 130 m tall) get
      // clipped or rendered edge-on as a thin vertical sliver.
      const basePositions = points.map((p) =>
        Cartesian3.fromDegrees(p.longitude, p.latitude, baseElevation),
      );
      const topPositions = points.map((p) =>
        Cartesian3.fromDegrees(p.longitude, p.latitude, baseElevation + safeHeight),
      );

      const id = 'live-volume-preview';
      const entity = buildExtrudedStockpileEntity({
        id,
        vertices: basePositions,
        baseHeight: baseElevation,
        topHeight: baseElevation + safeHeight,
        color: materialColor(materialType),
      });
      v.entities.add(entity);
      entityIdRef.current = id;

      // Sphere over the full prism — guarantees the camera distance
      // accounts for both footprint width AND extrusion height.
      const sphere = BoundingSphere.fromPoints([...basePositions, ...topPositions]);

      // Aspect-aware pitch: when the prism is much taller than wide,
      // tilt the camera further down so the polygon footprint reads
      // instead of degenerating into a vertical line at eye height.
      const footprintRadius = BoundingSphere.fromPoints(basePositions).radius;
      const footprintWidth = Math.max(footprintRadius * 2, 0.1);
      const aspect = safeHeight / footprintWidth;
      let pitchDeg = -35;
      if (aspect > 5) pitchDeg = -60;
      else if (aspect > 2) pitchDeg = -45;

      v.camera.flyToBoundingSphere(sphere, {
        offset: new HeadingPitchRange(
          0,
          CesiumMath.toRadians(pitchDeg),
          Math.max(sphere.radius * 2.2, 20),
        ),
        duration: 0.5,
      });
      v.scene.requestRender();
    };

    // --- Phase 2: real GLB mesh ---
    if (glbUrl) {
      let cancelled = false;

      CesiumModel.fromGltfAsync({ url: glbUrl })
        .then((model) => {
          if (cancelled || !viewerRef.current || viewerRef.current.isDestroyed()) {
            model.destroy();
            return;
          }
          const v = viewerRef.current;
          v.scene.primitives.add(model);
          modelPrimitiveRef.current = model;
          v.scene.requestRender();

          model.readyEvent.addEventListener(() => {
            if (cancelled || !viewerRef.current || viewerRef.current.isDestroyed()) return;
            // Mirror the prism's aspect-aware framing — a degenerate
            // GLB (very tall vs. wide footprint) needs a steeper pitch
            // and more standoff to avoid reading as a vertical line.
            const r = model.boundingSphere.radius;
            const aspect = Math.max(meanHeight, 0.1) / Math.max(r * 2, 0.1);
            let pitchDeg = -35;
            if (aspect > 5) pitchDeg = -60;
            else if (aspect > 2) pitchDeg = -45;
            viewerRef.current.camera.flyToBoundingSphere(model.boundingSphere, {
              offset: new HeadingPitchRange(
                0,
                CesiumMath.toRadians(pitchDeg),
                Math.max(r * 2.2, 20),
              ),
              duration: 0.5,
            });
            viewerRef.current.scene.requestRender();
          });
        })
        .catch((err) => {
          if (cancelled) return;
          console.warn('[Volume3DPreview] GLB load failed, falling back to prism', err);
          loadPrism();
        });

      return () => {
        cancelled = true;
      };
    }

    // --- Phase 1 fallback: extruded prism ---
    loadPrism();
  }, [points, meanHeight, baseElevation, materialType, glbUrl]);

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ aspectRatio: '200 / 110', minHeight: 110, background: '#0a0a0e' }}
      aria-label="Stockpile 3D mesh preview"
    />
  );
}
