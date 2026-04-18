/**
 * Cesium primitives for the Annotate tool.
 *
 * Annotations live in their OWN named CustomDataSource — separate from
 * the `measurement-drawing` datasource — so that handlers that wipe
 * measurements (`clearMeasurementEntities` in the draw / profile / measure
 * hooks) don't take annotations down with them. Visibility is toggled
 * via the datasource `show` flag, driven by `layers.annotations.visible`.
 *
 * Each annotation renders as:
 *   - a short upright pin (cylinder/point on the canvas)
 *   - a label with the annotation text, offset above the pin
 * Both are clamped to ground so they sit on the terrain rather than
 * floating off the WGS-84 ellipsoid.
 */
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  VerticalOrigin,
  type Viewer as CesiumViewer,
} from 'cesium';
import type { Annotation } from '@/store/viewerStore';

const DS_NAME = 'annotations';
const PIN_FILL = Color.fromCssColorString('#22d3ee');     // accent cyan — matches profile chart fill
const PIN_OUTLINE = Color.fromCssColorString('#0e7490');  // darker rim for legibility on white ortho
const LABEL_BG = Color.fromCssColorString('#1e293b').withAlpha(0.92);

/**
 * Fetch (or lazily create) the dedicated annotation datasource on a
 * viewer. Safe to call repeatedly — Cesium's `getByName` returns the
 * existing instance.
 */
export function getOrCreateAnnotationDataSource(
  viewer: CesiumViewer,
): CustomDataSource {
  const existing = viewer.dataSources.getByName(DS_NAME);
  if (existing.length > 0) return existing[0] as CustomDataSource;
  const ds = new CustomDataSource(DS_NAME);
  viewer.dataSources.add(ds);
  return ds;
}

/** Toggle the entire annotation layer on/off (driven by the Layers tab). */
export function setAnnotationLayerVisible(
  viewer: CesiumViewer,
  visible: boolean,
): void {
  const ds = getOrCreateAnnotationDataSource(viewer);
  if (ds.show !== visible) {
    ds.show = visible;
    viewer.scene.requestRender();
  }
}

/**
 * Replace every entity in the annotation datasource with one entry per
 * annotation. We rebuild from scratch on every change because the list
 * is small (typically <50 pins) and rebuilding sidesteps reconciliation
 * bugs where a stale entity's `id` collides with an updated annotation.
 *
 * Each annotation's Cesium entity carries `id = annotation:<id>` so the
 * canvas pick handler in `useAnnotationLayer` can map a clicked entity
 * back to the source annotation (e.g. for delete via the rail).
 */
export function syncAnnotationEntities(
  viewer: CesiumViewer,
  annotations: Annotation[],
): void {
  const ds = getOrCreateAnnotationDataSource(viewer);
  ds.entities.removeAll();

  for (const ann of annotations) {
    const position = Cartesian3.fromDegrees(
      ann.point.longitude,
      ann.point.latitude,
      // Pass `0` for height — `HeightReference.CLAMP_TO_GROUND` will
      // re-anchor it on the active terrain. Using `ann.point.height`
      // (the captured terrain height at click time) would float above
      // when the user later toggles DTM↔DSM.
      0,
    );

    ds.entities.add({
      id: `annotation:${ann.id}`,
      position,
      point: {
        pixelSize: 12,
        color: PIN_FILL,
        outlineColor: PIN_OUTLINE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: ann.text,
        font: '12px ui-sans-serif, system-ui, sans-serif',
        fillColor: Color.WHITE,
        backgroundColor: LABEL_BG,
        showBackground: true,
        backgroundPadding: new Cartesian2(6, 4) as unknown as Cartesian2,
        pixelOffset: new Cartesian2(0, -18) as unknown as Cartesian2,
        verticalOrigin: VerticalOrigin.BOTTOM,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  viewer.scene.requestRender();
}
