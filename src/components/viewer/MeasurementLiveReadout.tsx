'use client';

/**
 * Live measurement readout — a small floating chip that follows the
 * cursor (Distance) or the polygon centroid (Area / Volume) while the
 * user is drawing. Closes the discoverability gap that made the Measure
 * tool feel broken: numbers used to only appear after the user
 * right-clicked / double-clicked, leaving them clicking vertices in
 * silence.
 *
 * Pattern lifted from Apple Maps Measure and Google Earth Pro: a single
 * chip near the active vertex that updates in real time. Visual style
 * mirrors the hint chip in `<ToolPalette>` so the two read as one
 * family of canvas affordances.
 *
 * Lifecycle:
 *
 *  - Renders only while `measurement.status === 'drawing'` AND there's
 *    at least one anchor point. Once the user finishes (right-click for
 *    polygons, double-click for distance), `useMeasurementHandler`
 *    drops a permanent Cesium label at the centroid — this chip steps
 *    out of the way to avoid double-labelling.
 *
 *  - Volume's terrain-sampling pass is async (see
 *    `computeVolumeFromTerrain` in measurementPrimitives) — between the
 *    right-click and the resolved volume there's a 100–500 ms window
 *    where `volumeCubicMeters` is undefined while `points` is locked.
 *    During that window we render "Computing volume…" so the user
 *    knows the gap is intentional, not a bug.
 *
 *  - Anchor projection runs both on store change AND on each Cesium
 *    `preRender` tick (RAF-throttled by the viewer's own loop). The
 *    second listener catches camera moves: if the user pans/zooms
 *    mid-draw, the chip stays glued to the world position.
 *
 *  - Off-screen vertices: `worldToWindowCoordinates` returns
 *    `undefined` when the position is behind the camera or outside the
 *    canvas. We hide the chip rather than clamp — a chip pinned to the
 *    rail edge with a wrong number is worse than no chip at all.
 *
 * @see plans/quirky-munching-corbato.md — Polish Addendum, Phase 3.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Hexagon, Ruler, Square, TrendingUp } from 'lucide-react';
import {
  Cartesian2,
  Cartesian3,
  SceneTransforms,
  type Viewer as CesiumViewer,
} from 'cesium';

import { useViewerStore, type MeasurementPoint } from '@/store/viewerStore';
import {
  formatArea,
  formatDistance,
  formatVolume,
} from '@/lib/cesium/measurementPrimitives';
import { centroidOf } from '@/lib/cesium/profileMetrics';
import { cn } from '@/lib/utils';

interface Props {
  viewerRef: React.RefObject<CesiumViewer | null>;
}

/**
 * Choose where the chip anchors:
 *  - Distance → last placed vertex (the live segment trails the cursor
 *    here; pinning to the cursor would drift left/right of the actual
 *    measurement and feel unstable).
 *  - Area / Volume → polygon centroid. Matches the position where
 *    `addLabel(...)` will eventually drop the permanent label so the
 *    chip-to-label transition feels like a fade, not a jump.
 */
function pickAnchorPoint(
  tool: 'distance' | 'area' | 'volume' | null,
  points: MeasurementPoint[],
): MeasurementPoint | null {
  if (points.length === 0) return null;
  if (tool === 'distance') return points[points.length - 1];
  // Centroid in WGS-84 — degree-space mean is enough for a cosmetic
  // anchor (the polygons users draw with this tool are almost always
  // within a few hundred metres). Delegated to `centroidOf` so the
  // Inspector card and this chip never drift apart on the same input.
  return centroidOf(points);
}

/**
 * Return the icon JSX for the active tool. Returning JSX (not a
 * component reference) sidesteps React 19's `static-components` rule —
 * `const Icon = pickIcon(tool)` would otherwise be flagged as creating
 * a component during render. The unused `Mountain` / `TrendingUp` cases
 * keep the import surface ready for the Phase 4 expansion (live
 * polyline-length readout for profile / cross-section).
 */
function renderIcon(tool: 'distance' | 'area' | 'volume' | null) {
  switch (tool) {
    case 'distance':
      return <Ruler className="size-3" />;
    case 'area':
      return <Square className="size-3" />;
    case 'volume':
      return <Hexagon className="size-3" />;
    default:
      return <TrendingUp className="size-3" />;
  }
}

export const MeasurementLiveReadout: React.FC<Props> = ({ viewerRef }) => {
  // Selector is narrow on purpose — this component re-renders on every
  // measurement update (one per click + one per mouse-move) and we want
  // Zustand to bail out of subscribers whose slices haven't changed.
  const measurement = useViewerStore((s) => s.measurement);

  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  // Persisted result/scratch buffer to keep the projection allocation-free
  // — `worldToWindowCoordinates` writes into the supplied `result`.
  const scratchRef = useRef<Cartesian2>(new Cartesian2());

  const tool = measurement.tool;
  const points = measurement.points;
  const status = measurement.status;
  const visible = status === 'drawing' && points.length > 0;

  useEffect(() => {
    // The cleanup of the *previous* effect run resets `screenPos` (see
    // `return` below). When `visible` flips false, the cleanup fires
    // first, then this body short-circuits — so we never call
    // `setScreenPos` synchronously inside an effect body, which the
    // React 19 lint rule rightly forbids.
    if (!visible) return;
    const viewer = viewerRef.current;
    if (!viewer) return;

    const project = () => {
      const anchor = pickAnchorPoint(tool, points);
      if (!anchor) {
        setScreenPos(null);
        return;
      }
      const cart = Cartesian3.fromDegrees(
        anchor.longitude,
        anchor.latitude,
        anchor.height,
      );
      const win = SceneTransforms.worldToWindowCoordinates(
        viewer.scene,
        cart,
        scratchRef.current,
      );
      // Cesium returns `undefined` when the point is behind the camera
      // or otherwise un-projectable. Hide rather than render at (0, 0)
      // — a chip stuck in the corner is a worse signal than no chip.
      if (!win) {
        setScreenPos(null);
        return;
      }
      // Bail when the projection lands off-canvas — the user is
      // looking at a different part of the world from the chip's
      // anchor and a clamped chip would mislead.
      const canvas = viewer.scene.canvas;
      if (
        win.x < 0 ||
        win.y < 0 ||
        win.x > canvas.clientWidth ||
        win.y > canvas.clientHeight
      ) {
        setScreenPos(null);
        return;
      }
      setScreenPos({ x: win.x, y: win.y });
    };

    // Initial projection so the chip appears immediately on the first
    // vertex, not on the next preRender tick.
    project();
    // Re-project every frame so the chip tracks camera moves. Cesium's
    // own render loop is RAF-throttled, so we don't need an explicit
    // throttle here.
    viewer.scene.preRender.addEventListener(project);
    return () => {
      try {
        viewer.scene.preRender.removeEventListener(project);
      } catch {
        // viewer may already be destroyed during route teardown — the
        // preRender event is a Cesium Event whose underlying listener
        // array is null after dispose. Swallow rather than crash the
        // unmount.
      }
      // Clear the chip on cleanup (visibility change, tool change,
      // unmount). React batches this with the next render, so the
      // lint rule on setState-in-effect-body doesn't apply here.
      setScreenPos(null);
    };
  }, [visible, tool, points, viewerRef]);

  if (!visible || !screenPos) return null;

  const text = formatReadout(measurement);
  const wide = text.length > 18;

  return (
    <div
      role="status"
      aria-live="polite"
      // pointer-events-none is critical: the chip sits on top of the
      // canvas and would otherwise eat clicks meant for the next
      // measurement vertex. Translate3d (not top/left) keeps the chip
      // on the GPU compositor and avoids layout thrash on every frame.
      className={cn(
        'pointer-events-none absolute z-30 inline-flex items-center gap-1.5',
        'rounded-full bg-bg-surface/70 px-3 py-1 text-[11px] font-semibold tracking-tight text-accent',
        'shadow-md shadow-black/30 backdrop-blur-2xl',
        'supports-[backdrop-filter]:bg-bg-surface/55',
        'border border-accent/30',
      )}
      style={{
        // Offset so the chip sits *above* the anchor (above the cursor
        // for distance, above the centroid for area/volume) — the user's
        // pointer is at the anchor and a chip directly under it would
        // hide the next vertex they're about to drop.
        transform: `translate3d(${screenPos.x - (wide ? 90 : 60)}px, ${screenPos.y - 32}px, 0)`,
      }}
    >
      {renderIcon(tool)}
      {text}
    </div>
  );
};

/**
 * Build the chip text from the live measurement state.
 *
 * Why split out: keeps the component body declarative and lets us
 * special-case the Volume async window (the right-click→terrain-sample
 * gap where `volumeCubicMeters` is briefly undefined).
 */
function formatReadout(m: {
  tool: 'distance' | 'area' | 'volume' | null;
  status: 'idle' | 'drawing' | 'complete';
  points: MeasurementPoint[];
  distanceMeters?: number;
  areaSquareMeters?: number;
  volumeCubicMeters?: number;
}): string {
  if (m.tool === 'distance') {
    return m.distanceMeters !== undefined ? formatDistance(m.distanceMeters) : '0 m';
  }
  if (m.tool === 'area') {
    return m.areaSquareMeters !== undefined ? formatArea(m.areaSquareMeters) : '0 m²';
  }
  if (m.tool === 'volume') {
    if (m.volumeCubicMeters !== undefined) return formatVolume(m.volumeCubicMeters);
    // Volume's terrain-sample pass is async — between the right-click
    // and the resolved volume, points are locked but the number isn't
    // ready yet. Show progress, not the stale area value.
    if (m.points.length >= 3) return 'Computing volume…';
    if (m.areaSquareMeters !== undefined) return formatArea(m.areaSquareMeters);
    return '0 m³';
  }
  return '';
}

