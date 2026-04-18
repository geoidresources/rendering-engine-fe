/**
 * Keeps the Cesium annotation datasource in lock-step with the
 * `annotations` array in the viewer store, and toggles its visibility
 * from `layers.annotations.visible`.
 *
 * Sync strategy: blunt rebuild. The annotation list is small (typically
 * <50) and rebuilding sidesteps the entity-id reconciliation pitfalls
 * that bit us on the polygons layer in earlier phases.
 */
import { useEffect } from 'react';
import { type Viewer as CesiumViewer } from 'cesium';
import { useViewerStore } from '@/store/viewerStore';
import {
  setAnnotationLayerVisible,
  syncAnnotationEntities,
} from '@/lib/cesium/annotationPrimitives';

export function useAnnotationLayer(
  viewerRef: React.RefObject<CesiumViewer | null>,
) {
  const annotations = useViewerStore((s) => s.annotations);
  const visible = useViewerStore((s) => s.layers.annotations.visible);

  // Re-sync entities whenever the list changes.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    syncAnnotationEntities(viewer, annotations);
  }, [annotations, viewerRef]);

  // Mirror the layer toggle.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    setAnnotationLayerVisible(viewer, visible);
  }, [visible, viewerRef]);
}
