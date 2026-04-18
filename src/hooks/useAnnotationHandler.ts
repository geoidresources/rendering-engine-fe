/**
 * Cesium ScreenSpaceEventHandler for the Annotate tool.
 *
 *   left-click on canvas → capture position → open AnnotationModal
 *   Esc                 → cancel and return to Select
 *
 * Unlike `useDrawingHandler` / `useProfileHandler`, there is no
 * rubber-band geometry — a single click is the whole gesture, so we
 * don't paint a live entity. The modal that opens off
 * `annotationDraft.point` blocks further canvas interaction until the
 * user types a label and saves (or cancels), which keeps the click flow
 * predictable: one click = one pin.
 */
import { useEffect, useRef } from 'react';
import {
  type Cartesian2,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer as CesiumViewer,
} from 'cesium';
import { useViewerStore } from '@/store/viewerStore';
import {
  pickScenePosition,
  cartesianToMeasurementPoint,
} from '@/lib/cesium/measurementPrimitives';

export function useAnnotationHandler(
  viewerRef: React.RefObject<CesiumViewer | null>,
) {
  const activeTool = useViewerStore((s) => s.activeTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const startAnnotationDraft = useViewerStore((s) => s.startAnnotationDraft);
  const cancelAnnotationDraft = useViewerStore((s) => s.cancelAnnotationDraft);
  const draftPoint = useViewerStore((s) => s.annotationDraft.point);

  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // ── Wire / tear down the canvas handler. ───────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (activeTool !== 'annotate') {
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      return;
    }

    // Don't add a handler while the modal is open — otherwise a stray
    // click that lands on the canvas behind the modal would clobber the
    // current draft.
    if (draftPoint) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((click: { position: Cartesian2 }) => {
      const pos = pickScenePosition(viewer, click.position);
      if (!pos) return;
      startAnnotationDraft(cartesianToMeasurementPoint(pos));
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
    };
  }, [activeTool, draftPoint, viewerRef, startAnnotationDraft]);

  // ── Esc cancels: clears any pending draft AND returns to Select. ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeTool !== 'annotate') return;
      cancelAnnotationDraft();
      setActiveTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTool, cancelAnnotationDraft, setActiveTool]);
}
