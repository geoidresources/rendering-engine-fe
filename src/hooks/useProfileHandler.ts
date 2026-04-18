/**
 * Cesium ScreenSpaceEventHandler for the Profile / Cross-section
 * submodes. Mirrors `useDrawingHandler`, but on finalize it samples the
 * active terrain provider along the user-drawn polyline and writes the
 * resulting `{distance, height}[]` into `viewerStore.profile.samples`.
 *
 * The ProfileChart card (mounted in `Viewer.tsx`) auto-shows when
 * `profile.samples != null` and disappears when the user closes it.
 *
 *   left-click       → push waypoint
 *   mouse-move       → live rubber-band (cursor follows)
 *   right-click      → finalize → sample terrain → render chart
 *   double-click     → finalize (alias for touch users)
 *   Esc              → cancel and clear
 */
import { useEffect, useRef } from 'react';
import {
  Cartesian3,
  Cartesian2,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer as CesiumViewer,
} from 'cesium';
import { useViewerStore } from '@/store/viewerStore';
import {
  pickScenePosition,
  getOrCreateDataSource,
  clearMeasurementEntities,
  addPointMarker,
  createLivePolyline,
  sampleTerrainAlongPolyline,
} from '@/lib/cesium/measurementPrimitives';

/** N samples along the polyline. 200 matches the plan's "≥100" target
 *  and stays comfortably below the per-tile sampleTerrain limit. */
const PROFILE_SAMPLE_COUNT = 200;

export function useProfileHandler(
  viewerRef: React.RefObject<CesiumViewer | null>,
) {
  const activeTool = useViewerStore((s) => s.activeTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const setProfileSamples = useViewerStore((s) => s.setProfileSamples);
  const clearProfile = useViewerStore((s) => s.clearProfile);
  const profileSamples = useViewerStore((s) => s.profile.samples);

  const isProfileMode =
    activeTool === 'profile' || activeTool === 'cross-section';

  // Cesium-side state — refs so mouse-move never re-renders React.
  const waypointsRef = useRef<Cartesian3[]>([]);
  const cursorRef = useRef<Cartesian3 | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // ── 1. Wire / tear down the canvas handler. ─────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (!isProfileMode) {
      // Tear down handler when leaving profile mode. We DON'T clear the
      // measurement entities here unconditionally — the sampling
      // happens after activeTool flips back to 'select' (so the chart
      // appears), and we want the on-canvas line to stay visible while
      // the user reads the chart.
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      waypointsRef.current = [];
      cursorRef.current = null;
      // Clear visualisation when there's no chart open AND we're not in
      // profile mode. (If samples != null we keep the line on canvas.)
      if (!profileSamples) clearMeasurementEntities(viewer);
      return;
    }

    // Entering profile mode — reset everything.
    waypointsRef.current = [];
    cursorRef.current = null;
    clearMeasurementEntities(viewer);
    clearProfile();

    const ds = getOrCreateDataSource(viewer);
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    // Live polyline preview (committed waypoints + cursor).
    createLivePolyline(ds, () => {
      const pts = [...waypointsRef.current];
      if (cursorRef.current) pts.push(cursorRef.current);
      return pts;
    });

    // Push waypoint on left-click.
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const pos = pickScenePosition(viewer, click.position);
      if (!pos) return;
      waypointsRef.current.push(pos);
      addPointMarker(ds, pos);
      viewer.scene.requestRender();
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Cursor for live preview.
    handler.setInputAction((move: { endPosition: Cartesian2 }) => {
      cursorRef.current = pickScenePosition(viewer, move.endPosition);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // Finalize → sample terrain → set store → flip back to Select.
    const finish = async () => {
      const wps = [...waypointsRef.current];
      if (wps.length < 2) return;
      cursorRef.current = null;
      viewer.scene.requestRender();

      // Capture mode BEFORE we set 'select' below (so we know which
      // chart variant to render).
      const mode = activeTool === 'cross-section' ? 'cross-section' : 'profile';

      const samples = await sampleTerrainAlongPolyline(
        viewer,
        wps,
        PROFILE_SAMPLE_COUNT,
      );
      if (samples.length === 0) return;

      setProfileSamples(samples, mode);
      // Drop the user back into Select so they can interact with the
      // chart / canvas without accidentally adding more waypoints.
      setActiveTool('select');
    };
    handler.setInputAction(finish, ScreenSpaceEventType.RIGHT_CLICK);
    handler.setInputAction(finish, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
    };
  }, [
    isProfileMode,
    activeTool,
    viewerRef,
    profileSamples,
    setProfileSamples,
    setActiveTool,
    clearProfile,
  ]);

  // ── 2. Esc cancels (window-level so it works while focus is in the canvas). ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!isProfileMode) return;
      const viewer = viewerRef.current;
      if (viewer) clearMeasurementEntities(viewer);
      waypointsRef.current = [];
      cursorRef.current = null;
      clearProfile();
      setActiveTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isProfileMode, viewerRef, clearProfile, setActiveTool]);
}
