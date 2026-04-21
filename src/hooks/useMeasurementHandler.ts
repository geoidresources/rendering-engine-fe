/**
 * Hook that wires Cesium ScreenSpaceEventHandler to measurement drawing.
 * Handles distance (polyline), area (polygon), and volume (polygon + terrain sampling).
 *
 * Usage: call in Viewer.tsx and pass the viewer ref.
 *   const { clearDrawing } = useMeasurementHandler(viewerRef);
 */
import { useEffect, useCallback, useRef } from 'react';
import {
  Cartesian3,
  Cartesian2,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer as CesiumViewer,
} from 'cesium';
import { useViewerStore } from '../store/viewerStore';
import {
  pickScenePosition,
  cartesianToMeasurementPoint,
  computeDistanceMeters,
  computeAreaSquareMeters,
  computeVolumeFromTerrain,
  formatDistance,
  formatArea,
  formatVolume,
  getOrCreateDataSource,
  clearMeasurementEntities,
  addPointMarker,
  addLabel,
  createLivePolyline,
  createLivePolygon,
} from '../lib/cesium/measurementPrimitives';

export function useMeasurementHandler(
  viewerRef: React.RefObject<CesiumViewer | null>,
) {
  const activeTool = useViewerStore((s) => s.activeTool);
  const setMeasurement = useViewerStore((s) => s.setMeasurement);
  const clearMeasurement = useViewerStore((s) => s.clearMeasurement);
  const measurement = useViewerStore((s) => s.measurement);

  const verticesRef = useRef<Cartesian3[]>([]);
  const cursorRef = useRef<Cartesian3 | null>(null);
  const isDrawingRef = useRef(false);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // ---- Main effect: set up drawing handlers when tool is active ----
  useEffect(() => {
    const viewer = viewerRef.current;

    // This hook owns ONLY the classical measurement tools (distance,
    // area, volume). The polygon-draw tool, profile and cross-section
    // each have their own dedicated handler; if we activated for those
    // here we'd race for canvas events and `clearMeasurementEntities`
    // would wipe the other handler's preview polyline.
    const isClassicalMeasure =
      activeTool === 'distance' ||
      activeTool === 'area' ||
      activeTool === 'volume';
    if (!viewer || !isClassicalMeasure) {
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      return;
    }

    // Reset drawing state when entering a measurement tool
    verticesRef.current = [];
    cursorRef.current = null;
    isDrawingRef.current = false;
    clearMeasurementEntities(viewer);
    clearMeasurement();

    const ds = getOrCreateDataSource(viewer);
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    const isPolygonTool = activeTool === 'area' || activeTool === 'volume';

    // Positions callback used by the live polyline/polygon entities.
    // Returns committed vertices + cursor position (rubber-band).
    const getPositions = (): Cartesian3[] => {
      const pts = [...verticesRef.current];
      if (cursorRef.current && isDrawingRef.current) {
        pts.push(cursorRef.current);
      }
      // For polygon tools, close the loop so the user sees the closing edge
      if (isPolygonTool && pts.length >= 3) {
        pts.push(pts[0]);
      }
      return pts;
    };

    // Create the live rubber-band entities
    createLivePolyline(ds, getPositions);
    if (isPolygonTool) {
      createLivePolygon(ds, () => {
        const pts = [...verticesRef.current];
        if (cursorRef.current && isDrawingRef.current) pts.push(cursorRef.current);
        return pts;
      });
    }

    // ---- LEFT_CLICK: add a vertex ----
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const pos = pickScenePosition(viewer, click.position);
      if (!pos) return;

      verticesRef.current.push(pos);
      isDrawingRef.current = true;
      addPointMarker(ds, pos);

      // Update live measurement in the store
      const allPts = verticesRef.current;
      const mpts = allPts.map(cartesianToMeasurementPoint);

      if (activeTool === 'distance') {
        setMeasurement({
          tool: 'distance',
          status: 'drawing',
          points: mpts,
          distanceMeters: computeDistanceMeters(allPts),
        });
      } else {
        setMeasurement({
          tool: activeTool as 'area' | 'volume',
          status: 'drawing',
          points: mpts,
          areaSquareMeters: allPts.length >= 3 ? computeAreaSquareMeters(allPts) : 0,
        });
      }
      viewer.scene.requestRender();
    }, ScreenSpaceEventType.LEFT_CLICK);

    // ---- MOUSE_MOVE: update rubber-band + live readout ----
    handler.setInputAction((move: { endPosition: Cartesian2 }) => {
      if (!isDrawingRef.current) return;
      const pos = pickScenePosition(viewer, move.endPosition);
      cursorRef.current = pos;

      if (!pos || verticesRef.current.length === 0) return;
      const preview = [...verticesRef.current, pos];
      const mpts = preview.map(cartesianToMeasurementPoint);

      if (activeTool === 'distance') {
        setMeasurement({
          tool: 'distance',
          status: 'drawing',
          points: mpts,
          distanceMeters: computeDistanceMeters(preview),
        });
      } else if (isPolygonTool && preview.length >= 3) {
        setMeasurement({
          tool: activeTool as 'area' | 'volume',
          status: 'drawing',
          points: mpts,
          areaSquareMeters: computeAreaSquareMeters(preview),
        });
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // ---- Finish drawing (RIGHT_CLICK for polygon, DOUBLE_CLICK for distance) ----
    const finishDrawing = async () => {
      if (!isDrawingRef.current) return;

      const verts = [...verticesRef.current];
      isDrawingRef.current = false;
      cursorRef.current = null;

      // Minimum vertex requirements
      if (activeTool === 'distance' && verts.length < 2) return;
      if (isPolygonTool && verts.length < 3) return;

      const mpts = verts.map(cartesianToMeasurementPoint);

      if (activeTool === 'distance') {
        const dist = computeDistanceMeters(verts);
        // Place total distance label at midpoint
        const midIdx = Math.floor(verts.length / 2);
        addLabel(ds, verts[midIdx], formatDistance(dist));

        setMeasurement({
          tool: 'distance',
          status: 'complete',
          points: mpts,
          distanceMeters: dist,
        });
      } else {
        // Area / Volume
        const area = computeAreaSquareMeters(verts);

        // Centroid for label placement
        const centroid = verts.reduce(
          (acc, p) => Cartesian3.add(acc, p, acc),
          new Cartesian3(0, 0, 0),
        );
        Cartesian3.multiplyByScalar(centroid, 1 / verts.length, centroid);

        addLabel(ds, centroid, formatArea(area));

        if (activeTool === 'volume') {
          // Show area immediately, then compute volume async
          setMeasurement({
            tool: 'volume',
            status: 'drawing', // still computing
            points: mpts,
            areaSquareMeters: area,
          });

          // `computeVolumeFromTerrain` now returns a {fillVol, cutVol,
          // netVol, sampleCount, baseElevation} struct — the live chip +
          // Inspector headline still want one number, so we surface
          // `netVol` as `volumeCubicMeters` (matches the historical
          // `Math.abs`-summed value when the polygon has no interior
          // depressions, which is the common stockpile case). The full
          // breakdown lives on `measurement.volumeBreakdown` for the
          // Volume card to surface cut/fill chips + a confidence badge.
          // Default base plane is 'avg' to preserve pre-card numbers.
          const result = await computeVolumeFromTerrain(viewer, verts, {
            basePlane: 'avg',
          });
          addLabel(ds, centroid, `Vol: ${formatVolume(result.netVol)}`, 16);

          setMeasurement({
            tool: 'volume',
            status: 'complete',
            points: mpts,
            areaSquareMeters: area,
            volumeCubicMeters: result.netVol,
            volumeBreakdown: result,
            basePlane: 'avg',
          });
        } else {
          setMeasurement({
            tool: 'area',
            status: 'complete',
            points: mpts,
            areaSquareMeters: area,
          });
        }
      }

      viewer.scene.requestRender();
    };

    handler.setInputAction(finishDrawing, ScreenSpaceEventType.RIGHT_CLICK);
    handler.setInputAction(() => {
      if (activeTool === 'distance') finishDrawing();
    }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    return () => {
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
    };
  }, [activeTool, viewerRef, setMeasurement, clearMeasurement]);

  // ---- Watch for external clear (InspectorPanel "Clear" button) ----
  // When measurement is reset to idle + null tool, wipe the drawing entities.
  useEffect(() => {
    if (measurement.status === 'idle' && measurement.tool === null) {
      const viewer = viewerRef.current;
      if (viewer) clearMeasurementEntities(viewer);
      verticesRef.current = [];
      cursorRef.current = null;
      isDrawingRef.current = false;
    }
  }, [measurement.status, measurement.tool, viewerRef]);

  // ---- Public API ----
  const clearDrawing = useCallback(() => {
    const viewer = viewerRef.current;
    if (viewer) clearMeasurementEntities(viewer);
    verticesRef.current = [];
    cursorRef.current = null;
    isDrawingRef.current = false;
    clearMeasurement();
  }, [viewerRef, clearMeasurement]);

  return { clearDrawing };
}
