/**
 * Cesium ScreenSpaceEventHandler that captures user clicks while
 * `activeTool === 'draw-polygon'` and turns them into a polygon ring.
 *
 * Mirrors `useMeasurementHandler.ts` but persists vertices to
 * `viewerStore.drawing` so the SaveRegionModal can serialise them
 * straight into a GeoJSON Polygon — no Cesium reference required at
 * the modal layer.
 *
 *   left-click       → push vertex
 *   mouse-move       → live rubber-band (cursor follows)
 *   right-click      → finalize polygon → opens save modal
 *   double-click     → finalize polygon (alias for touch users)
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
  cartesianToMeasurementPoint,
  getOrCreateDataSource,
  clearMeasurementEntities,
  addPointMarker,
  createLivePolyline,
  createLivePolygon,
} from '@/lib/cesium/measurementPrimitives';

const DS_NAME = 'draw-tool';

export function useDrawingHandler(
  viewerRef: React.RefObject<CesiumViewer | null>,
) {
  const activeTool = useViewerStore((s) => s.activeTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const startDrawing = useViewerStore((s) => s.startDrawing);
  const pushDrawingVertex = useViewerStore((s) => s.pushDrawingVertex);
  const finalizeDrawing = useViewerStore((s) => s.finalizeDrawing);
  const cancelDrawing = useViewerStore((s) => s.cancelDrawing);
  const drawingActive = useViewerStore((s) => s.drawing.active);
  const drawingModalOpen = useViewerStore((s) => s.drawing.modalOpen);

  // Cesium-side state — kept out of the store so we don't trigger React
  // re-renders on every mouse-move while drawing.
  const cartesianVertsRef = useRef<Cartesian3[]>([]);
  const cursorRef = useRef<Cartesian3 | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // ── 1. When the user picks the Draw tool, prime the store. ─────────────
  // Done in an effect so the action is fired in response to the tool
  // change rather than from inside another setState (avoids the
  // Next-16 react-hooks/set-state-in-effect rule trigger when nested).
  useEffect(() => {
    if (activeTool === 'draw-polygon' && !drawingActive && !drawingModalOpen) {
      startDrawing();
    }
  }, [activeTool, drawingActive, drawingModalOpen, startDrawing]);

  // ── 2. Wire / tear down the canvas handler. ─────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (activeTool !== 'draw-polygon') {
      // Tear down handler + on-canvas entities when leaving Draw mode.
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      cartesianVertsRef.current = [];
      cursorRef.current = null;
      // Don't clear entities while the modal is up — the user should
      // still see their polygon while typing the name.
      if (!drawingModalOpen) clearMeasurementEntities(viewer, DS_NAME);
      return;
    }

    // Entering draw mode — reset everything.
    cartesianVertsRef.current = [];
    cursorRef.current = null;
    clearMeasurementEntities(viewer, DS_NAME);

    const ds = getOrCreateDataSource(viewer, DS_NAME);
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    // Live polyline (closing edge) + filled polygon preview.
    createLivePolyline(ds, () => {
      const pts = [...cartesianVertsRef.current];
      if (cursorRef.current) pts.push(cursorRef.current);
      if (pts.length >= 3) pts.push(pts[0]);
      return pts;
    });
    createLivePolygon(ds, () => {
      const pts = [...cartesianVertsRef.current];
      if (cursorRef.current) pts.push(cursorRef.current);
      return pts;
    });

    // Push vertex on left-click.
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const pos = pickScenePosition(viewer, click.position);
      if (!pos) return;
      cartesianVertsRef.current.push(pos);
      addPointMarker(ds, pos);
      pushDrawingVertex(cartesianToMeasurementPoint(pos));
      viewer.scene.requestRender();
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Cursor for live edge preview.
    handler.setInputAction((move: { endPosition: Cartesian2 }) => {
      cursorRef.current = pickScenePosition(viewer, move.endPosition);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // Finalize on right-click or double-click.
    const finish = () => {
      if (cartesianVertsRef.current.length < 3) return;
      cursorRef.current = null;
      viewer.scene.requestRender();
      finalizeDrawing();
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
    activeTool,
    viewerRef,
    pushDrawingVertex,
    finalizeDrawing,
    drawingModalOpen,
  ]);

  // ── 3. Esc cancels (window-level so it works while focus is in the canvas). ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeTool !== 'draw-polygon') return;
      const viewer = viewerRef.current;
      if (viewer) clearMeasurementEntities(viewer, DS_NAME);
      cartesianVertsRef.current = [];
      cursorRef.current = null;
      cancelDrawing();
      setActiveTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTool, viewerRef, cancelDrawing, setActiveTool]);

  // ── 4. When the modal closes (save or cancel) wipe entities. ────────────
  // The modal flips drawing.modalOpen → false via closeDrawingModal.
  useEffect(() => {
    if (drawingModalOpen) return;
    if (activeTool === 'draw-polygon') return;
    const viewer = viewerRef.current;
    if (viewer) clearMeasurementEntities(viewer, DS_NAME);
    cartesianVertsRef.current = [];
    cursorRef.current = null;
  }, [drawingModalOpen, activeTool, viewerRef]);
}
