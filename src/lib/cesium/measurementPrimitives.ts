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
 * Choices for the synthetic base plane used by `computeVolumeFromTerrain`.
 *
 * - `'avg'` (default, preserves the historical behaviour) — flat plane at
 *   the mean of the boundary vertex heights. Best for roughly horizontal
 *   stockpile pads.
 * - `'min'` — flat plane at the lowest vertex. Conservative; tends to
 *   over-state fill (everything counts as material).
 * - `'max'` — flat plane at the highest vertex. The opposite — under-states
 *   fill, over-states cut. Useful when the operator drew the polygon
 *   along a ridge.
 * - `'fitted'` — least-squares plane through the boundary vertices,
 *   evaluated at every sample's lng/lat. Best for tilted terrain
 *   (benches, road shoulders) where a flat base would bias the answer.
 *
 * The card lets the user toggle this; `'avg'` is the default so existing
 * call sites (and the live chip's single number) keep matching the
 * pre-Polish-Phase-4 numbers.
 */
export type VolumeBasePlane = 'avg' | 'min' | 'max' | 'fitted';

export interface VolumeResult {
  /** Material above the base plane (m³). For a stockpile this is the
   *  "real" volume — the part that physically sits on the ground. */
  fillVol: number;
  /** Material below the base plane (m³). For a clean stockpile this
   *  should be ~0; non-zero values mean the polygon footprint includes
   *  depressions/pits. The card surfaces this as a confidence warning. */
  cutVol: number;
  /** `fillVol - cutVol`. The number we hand to the live chip + the
   *  Inspector headline. Matches the historical `computeVolumeFromTerrain`
   *  return value when `cutVol === 0` (the typical stockpile case). */
  netVol: number;
  /** Number of interior grid points the terrain was sampled at. Drives
   *  the card's confidence chip (≥200 high, 50–200 medium, <50 low). */
  sampleCount: number;
  /** Base plane elevation actually used (metres a.s.l.). For
   *  `'fitted'` this is the plane elevation at the polygon centroid —
   *  reported back so the card can show one number, not a 3-coefficient
   *  fit equation that no operator would read. */
  baseElevation: number;
}

/**
 * Approximate volume of material within a polygon, split into above-base
 * (fill) and below-base (cut) components. Samples the current terrain
 * provider on a 25×25 grid; the historical implementation summed the
 * absolute deviation, conflating cut and fill — the Measurement Results
 * Card needs the signed split per PRD Stage 20 (Cut-Fill Analysis).
 */
export async function computeVolumeFromTerrain(
  viewer: CesiumViewer,
  vertices: Cartesian3[],
  opts: { basePlane?: VolumeBasePlane } = {},
): Promise<VolumeResult> {
  const empty: VolumeResult = {
    fillVol: 0,
    cutVol: 0,
    netVol: 0,
    sampleCount: 0,
    baseElevation: 0,
  };

  const tp = viewer.terrainProvider;
  if (!tp || tp instanceof EllipsoidTerrainProvider) return empty;
  if (vertices.length < 3) return empty;

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

  const basePlane: VolumeBasePlane = opts.basePlane ?? 'avg';

  // Pre-compute the base plane. For `'fitted'` we solve a 3-coeff
  // least-squares fit `z = a·lon + b·lat + c` over the boundary vertices
  // — when there are <3 vertices we'd already have returned above.
  let baseAtSample: (lon: number, lat: number) => number;
  let baseElevationAtCentroid: number;
  if (basePlane === 'fitted') {
    const fit = fitPlaneRad(cartos);
    baseAtSample = (lon, lat) => fit.a * lon + fit.b * lat + fit.c;
    baseElevationAtCentroid = baseAtSample(
      (minLon + maxLon) / 2,
      (minLat + maxLat) / 2,
    );
  } else {
    let baseHeight: number;
    if (basePlane === 'min') {
      baseHeight = cartos.reduce((m, c) => Math.min(m, c.height ?? 0), Infinity);
    } else if (basePlane === 'max') {
      baseHeight = cartos.reduce((m, c) => Math.max(m, c.height ?? 0), -Infinity);
    } else {
      // 'avg' — historical default
      baseHeight =
        cartos.reduce((s, c) => s + (c.height || 0), 0) / cartos.length;
    }
    baseAtSample = () => baseHeight;
    baseElevationAtCentroid = baseHeight;
  }

  const N = 25;
  const dLon = (maxLon - minLon) / N;
  const dLat = (maxLat - minLat) / N;
  if (dLon <= 0 || dLat <= 0) return empty;

  // Build sample grid — only points inside polygon. We carry the
  // per-sample base height alongside (matters for `'fitted'` mode where
  // each sample sees a different base elevation).
  const samples: Cartographic[] = [];
  const baseHeights: number[] = [];
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const lon = minLon + i * dLon;
      const lat = minLat + j * dLat;
      if (pointInPolygonRad(lon, lat, cartos)) {
        samples.push(Cartographic.fromRadians(lon, lat));
        baseHeights.push(baseAtSample(lon, lat));
      }
    }
  }
  if (samples.length === 0) return empty;

  try {
    await sampleTerrainMostDetailed(tp, samples);
  } catch {
    return empty;
  }

  // Cell area in m² (approximate for small regions)
  const R = 6_371_000;
  const midLat = (minLat + maxLat) / 2;
  const cellW = dLon * R * Math.cos(midLat);
  const cellH = dLat * R;
  const cellArea = cellW * cellH;

  let fillVol = 0; // terrain above base — typical stockpile material
  let cutVol = 0; // terrain below base — depressions inside footprint
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.height === undefined) continue;
    const d = s.height - baseHeights[i];
    if (d > 0) fillVol += d * cellArea;
    else cutVol += -d * cellArea;
  }

  return {
    fillVol,
    cutVol,
    netVol: fillVol - cutVol,
    sampleCount: samples.length,
    baseElevation: baseElevationAtCentroid,
  };
}

/**
 * Least-squares fit `z = a·lon + b·lat + c` to a set of (lon, lat, h)
 * points. Used by `computeVolumeFromTerrain` when the user picks the
 * `'fitted'` base plane — best for tilted ground where a flat plane
 * biases the cut/fill split.
 *
 * Solved by closed-form normal equations on the 3×3 Gram matrix; the
 * polygons we see in practice (tens of vertices, max) make iterative
 * QR overkill. Returns the historical `'avg'` plane on degenerate
 * input (collinear vertices, singular matrix) so we never propagate
 * NaN into the volume sums.
 */
function fitPlaneRad(
  cartos: Cartographic[],
): { a: number; b: number; c: number } {
  const n = cartos.length;
  const mean =
    cartos.reduce((s, c) => s + (c.height ?? 0), 0) / Math.max(1, n);
  if (n < 3) return { a: 0, b: 0, c: mean };

  // Build the 3×3 X^T·X and 3-vector X^T·z for the design matrix
  // [lon, lat, 1]. `s1` is `n` because the third column of X is
  // identically 1 — keep the name to match the closed-form derivation.
  let sLL = 0, sLA = 0, sL = 0, sAA = 0, sA = 0;
  const s1 = n;
  let sLZ = 0, sAZ = 0, sZ = 0;
  for (const c of cartos) {
    const lon = c.longitude;
    const lat = c.latitude;
    const z = c.height ?? 0;
    sLL += lon * lon;
    sLA += lon * lat;
    sL += lon;
    sAA += lat * lat;
    sA += lat;
    sLZ += lon * z;
    sAZ += lat * z;
    sZ += z;
  }

  // Solve the 3×3 system by Cramer's rule. det == 0 → collinear input
  // → fall back to the flat mean plane.
  const det =
    sLL * (sAA * s1 - sA * sA) -
    sLA * (sLA * s1 - sA * sL) +
    sL * (sLA * sA - sAA * sL);
  if (Math.abs(det) < 1e-30) return { a: 0, b: 0, c: mean };

  const detA =
    sLZ * (sAA * s1 - sA * sA) -
    sLA * (sAZ * s1 - sA * sZ) +
    sL * (sAZ * sA - sAA * sZ);
  const detB =
    sLL * (sAZ * s1 - sA * sZ) -
    sLZ * (sLA * s1 - sA * sL) +
    sL * (sLA * sZ - sAZ * sL);
  const detC =
    sLL * (sAA * sZ - sAZ * sA) -
    sLA * (sLA * sZ - sAZ * sL) +
    sLZ * (sLA * sA - sAA * sL);

  return { a: detA / det, b: detB / det, c: detC / det };
}

/**
 * Total perimeter (closed loop) of the polygon defined by `points`,
 * in metres. Each edge is computed as a great-circle arc on the WGS-84
 * ellipsoid; the closing edge `points[n-1] → points[0]` is included so
 * that callers don't have to repeat the first vertex at the end.
 *
 * Returns 0 for fewer than 2 points (no edge).
 */
export function computePerimeterMeters(points: Cartesian3[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = Cartographic.fromCartesian(points[i]);
    const b = Cartographic.fromCartesian(points[(i + 1) % points.length]);
    total += new EllipsoidGeodesic(a, b).surfaceDistance ?? 0;
  }
  return total;
}

/**
 * Total ground (2D) distance — sum of geodesic surface arcs only,
 * ignoring vertical deltas. Pair with `computeDistanceMeters` (which
 * adds the vertical component) to expose the slant-vs-ground delta in
 * the Distance card.
 */
export function computeGroundDistanceMeters(points: Cartesian3[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = Cartographic.fromCartesian(points[i - 1]);
    const b = Cartographic.fromCartesian(points[i]);
    total += new EllipsoidGeodesic(a, b).surfaceDistance ?? 0;
  }
  return total;
}

/**
 * Compass bearing from `start` to `end`, in degrees normalised to
 * [0, 360) — 0 = North, 90 = East. Uses `EllipsoidGeodesic.startHeading`
 * (radians, [-π, π]) and shifts into the user-friendly compass range.
 */
export function computeBearingDeg(start: Cartesian3, end: Cartesian3): number {
  const a = Cartographic.fromCartesian(start);
  const b = Cartographic.fromCartesian(end);
  const rad = new EllipsoidGeodesic(a, b).startHeading ?? 0;
  return ((rad * 180) / Math.PI + 360) % 360;
}

/**
 * Sample the active terrain provider along a polyline (waypoints in
 * Cartesian3) at `count` evenly-spaced points by total geodesic
 * distance. Returns `{ distance, height }[]` where `distance` is metres
 * from the polyline start and `height` is metres above the WGS-84
 * ellipsoid (whatever the current terrain provider returns).
 *
 * Falls back to scene.globe.getHeight() if the terrain provider does
 * not expose tiles for sampleTerrainMostDetailed (e.g. the default
 * EllipsoidTerrainProvider) — that gives the user *something* to look
 * at on demo / no-terrain surveys, even if it's all zeros.
 */
export async function sampleTerrainAlongPolyline(
  viewer: CesiumViewer,
  waypoints: Cartesian3[],
  count: number = 200,
): Promise<{ distance: number; height: number }[]> {
  if (waypoints.length < 2 || count < 2) return [];

  // ── 1. Build the polyline as a sequence of Cartographic waypoints +
  //       cumulative geodesic distance at each one. ─────────────────
  const wpCarto = waypoints.map((p) => Cartographic.fromCartesian(p));
  const segLen: number[] = [0];
  let total = 0;
  for (let i = 1; i < wpCarto.length; i++) {
    const g = new EllipsoidGeodesic(wpCarto[i - 1], wpCarto[i]);
    total += g.surfaceDistance ?? 0;
    segLen.push(total);
  }
  if (total <= 0) return [];

  // ── 2. Generate `count` sample positions evenly spaced by distance. ─
  const samplesCarto: Cartographic[] = [];
  const distances: number[] = [];
  for (let k = 0; k < count; k++) {
    const t = (k / (count - 1)) * total; // [0..total]
    distances.push(t);
    // Find segment that contains `t`
    let seg = 1;
    while (seg < segLen.length - 1 && segLen[seg] < t) seg++;
    const segStart = segLen[seg - 1];
    const segEnd = segLen[seg];
    const segSpan = segEnd - segStart;
    const local = segSpan > 0 ? (t - segStart) / segSpan : 0;
    const g = new EllipsoidGeodesic(wpCarto[seg - 1], wpCarto[seg]);
    const interp = g.interpolateUsingFraction(local);
    samplesCarto.push(Cartographic.fromRadians(interp.longitude, interp.latitude));
  }

  // ── 3. Sample heights via the terrain provider. ─────────────────────
  const tp = viewer.terrainProvider;
  let heights: number[] = [];
  if (tp && !(tp instanceof EllipsoidTerrainProvider)) {
    try {
      await sampleTerrainMostDetailed(tp, samplesCarto);
      heights = samplesCarto.map((s) => s.height ?? 0);
    } catch {
      heights = [];
    }
  }

  // Fallback: `scene.globe.getHeight()` reads whatever's currently
  // streamed in. Not as accurate as sampleTerrainMostDetailed but works
  // when the provider is the default ellipsoid (or the network fetch
  // failed).
  if (heights.length === 0) {
    const globe = viewer.scene.globe;
    heights = samplesCarto.map((s) => globe.getHeight(s) ?? 0);
  }

  return distances.map((distance, i) => ({ distance, height: heights[i] }));
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
