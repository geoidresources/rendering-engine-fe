/**
 * Cesium measurement drawing utilities and math functions.
 * Used by useMeasurementHandler hook for interactive measurement drawing.
 */
import {
  Cartesian3,
  Cartesian2,
  Cartographic,
  Color,
  Math as CesiumMath,
  Matrix4,
  Transforms,
  EllipsoidGeodesic,
  CustomDataSource,
  HeightReference,
  PolygonHierarchy,
  CallbackProperty,
  sampleTerrainMostDetailed,
  EllipsoidTerrainProvider,
  defined,
  type Viewer as CesiumViewer,
} from 'cesium';

// ---- Constants ----

const DS_NAME = 'measurement-drawing';
const POINT_COLOR = Color.fromCssColorString('#3b82f6');
const LINE_COLOR = Color.fromCssColorString('#3b82f6');
const POLYGON_FILL = Color.fromCssColorString('#3b82f6').withAlpha(0.15);
const LABEL_BG = Color.fromCssColorString('#1e293b').withAlpha(0.85);

// ===================== Scene Picking =====================

export function pickScenePosition(
  viewer: CesiumViewer,
  windowPosition: Cartesian2,
): Cartesian3 | null {
  const scene = viewer.scene;
  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(windowPosition);
    if (defined(picked)) return picked;
  }
  const ray = viewer.camera.getPickRay(windowPosition);
  if (!ray) return null;
  const globePick = scene.globe.pick(ray, scene);
  return defined(globePick) ? globePick : null;
}

// ===================== Coordinate Conversion =====================

export function cartesianToMeasurementPoint(position: Cartesian3) {
  const c = Cartographic.fromCartesian(position);
  return {
    longitude: CesiumMath.toDegrees(c.longitude),
    latitude: CesiumMath.toDegrees(c.latitude),
    height: c.height,
  };
}

// ===================== Geometry Math =====================

export function computeDistanceMeters(points: Cartesian3[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const start = Cartographic.fromCartesian(points[i - 1]);
    const end = Cartographic.fromCartesian(points[i]);
    const geodesic = new EllipsoidGeodesic(start, end);
    const surface = geodesic.surfaceDistance ?? 0;
    const dh = (end.height ?? 0) - (start.height ?? 0);
    total += Math.sqrt(surface * surface + dh * dh);
  }
  return total;
}

export function computeAreaSquareMeters(points: Cartesian3[]): number {
  if (points.length < 3) return 0;
  const sum = points.reduce(
    (acc, p) => Cartesian3.add(acc, p, acc),
    new Cartesian3(0, 0, 0),
  );
  const centroid = Cartesian3.multiplyByScalar(sum, 1 / points.length, new Cartesian3());
  const inv = Matrix4.inverseTransformation(
    Transforms.eastNorthUpToFixedFrame(centroid),
    new Matrix4(),
  );
  const proj = points.map((p) => Matrix4.multiplyByPoint(inv, p, new Cartesian3()));
  let s = 0;
  for (let i = 0; i < proj.length; i++) {
    const cur = proj[i];
    const nxt = proj[(i + 1) % proj.length];
    s += cur.x * nxt.y - nxt.x * cur.y;
  }
  return Math.abs(s) * 0.5;
}

/**
 * Approximate volume of material within a polygon above the average boundary elevation.
 * Samples the current terrain provider on a 25x25 grid and sums |height - base| * cellArea.
 */
export async function computeVolumeFromTerrain(
  viewer: CesiumViewer,
  vertices: Cartesian3[],
): Promise<number> {
  const tp = viewer.terrainProvider;
  if (!tp || tp instanceof EllipsoidTerrainProvider) return 0;
  if (vertices.length < 3) return 0;

  const cartos = vertices.map((v) => Cartographic.fromCartesian(v));

  // Bounding box (radians)
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const c of cartos) {
    if (c.longitude < minLon) minLon = c.longitude;
    if (c.longitude > maxLon) maxLon = c.longitude;
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
  }

  // Base height = average boundary height
  const baseHeight = cartos.reduce((s, c) => s + (c.height || 0), 0) / cartos.length;

  const N = 25;
  const dLon = (maxLon - minLon) / N;
  const dLat = (maxLat - minLat) / N;
  if (dLon <= 0 || dLat <= 0) return 0;

  // Build sample grid — only points inside polygon
  const samples: Cartographic[] = [];
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const lon = minLon + i * dLon;
      const lat = minLat + j * dLat;
      if (pointInPolygonRad(lon, lat, cartos)) {
        samples.push(Cartographic.fromRadians(lon, lat));
      }
    }
  }
  if (samples.length === 0) return 0;

  try {
    await sampleTerrainMostDetailed(tp, samples);
  } catch {
    return 0;
  }

  // Cell area in m² (approximate for small regions)
  const R = 6_371_000;
  const midLat = (minLat + maxLat) / 2;
  const cellW = dLon * R * Math.cos(midLat);
  const cellH = dLat * R;
  const cellArea = cellW * cellH;

  let vol = 0;
  for (const s of samples) {
    if (s.height !== undefined) {
      vol += Math.abs(s.height - baseHeight) * cellArea;
    }
  }
  return vol;
}

/** Ray-casting point-in-polygon test (all values in radians). */
function pointInPolygonRad(lon: number, lat: number, ring: Cartographic[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].longitude,
      yi = ring[i].latitude;
    const xj = ring[j].longitude,
      yj = ring[j].latitude;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ===================== Formatting =====================

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
}

export function formatArea(m2: number): string {
  return m2 >= 10_000 ? `${(m2 / 10_000).toFixed(2)} ha` : `${m2.toFixed(0)} m\u00B2`;
}

export function formatVolume(m3: number): string {
  return `${m3.toLocaleString(undefined, { maximumFractionDigits: 0 })} m\u00B3`;
}

// ===================== Entity Drawing Helpers =====================

export function getOrCreateDataSource(viewer: CesiumViewer): CustomDataSource {
  const existing = viewer.dataSources.getByName(DS_NAME);
  if (existing.length > 0) return existing[0] as CustomDataSource;
  const ds = new CustomDataSource(DS_NAME);
  viewer.dataSources.add(ds);
  return ds;
}

export function clearMeasurementEntities(viewer: CesiumViewer): void {
  const existing = viewer.dataSources.getByName(DS_NAME);
  if (existing.length > 0) {
    (existing[0] as CustomDataSource).entities.removeAll();
  }
  viewer.scene.requestRender();
}

export function addPointMarker(ds: CustomDataSource, position: Cartesian3): void {
  ds.entities.add({
    position,
    point: {
      pixelSize: 8,
      color: POINT_COLOR,
      outlineColor: Color.WHITE,
      outlineWidth: 2,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

export function addLabel(
  ds: CustomDataSource,
  position: Cartesian3,
  text: string,
  offsetY = -20,
): void {
  ds.entities.add({
    position,
    label: {
      text,
      font: '12px monospace',
      fillColor: Color.WHITE,
      backgroundColor: LABEL_BG,
      showBackground: true,
      backgroundPadding: new Cartesian2(6, 4) as any,
      pixelOffset: new Cartesian2(0, offsetY) as any,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
}

/** Live polyline entity with CallbackProperty positions (re-evaluated each frame). */
export function createLivePolyline(
  ds: CustomDataSource,
  getPositions: () => Cartesian3[],
): void {
  ds.entities.add({
    polyline: {
      positions: new CallbackProperty(getPositions, false) as any,
      width: 2,
      material: LINE_COLOR,
      clampToGround: true,
    },
  });
}

/** Live polygon entity for area/volume tools. Only renders when >= 3 positions. */
export function createLivePolygon(
  ds: CustomDataSource,
  getPositions: () => Cartesian3[],
): void {
  ds.entities.add({
    polygon: {
      hierarchy: new CallbackProperty(() => {
        const pts = getPositions();
        return pts.length >= 3 ? new PolygonHierarchy(pts) : new PolygonHierarchy([]);
      }, false) as any,
      show: new CallbackProperty(() => getPositions().length >= 3, false) as any,
      material: POLYGON_FILL,
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  });
}
