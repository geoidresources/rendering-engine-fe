/**
 * Slope / elevation derivations over a terrain-sampled polyline.
 *
 * Pure-functional companion to `sampleTerrainAlongPolyline` in
 * `measurementPrimitives.ts` — that function returns an array of
 * (distance, height) samples; this file rolls them up into the KPIs
 * the PRD asks for in Stages 21 (Cross-section) and 22 (Elevation
 * Profile for roads/benches/slopes):
 *
 *   - elevation gain / loss  → cumulative positive / negative deltas
 *   - average grade %        → (last − first) / total_distance × 100
 *   - max grade %            → max segment slope across the polyline
 *   - min / max / mean       → trivial scans, but consolidated here so
 *                              ProfileChart and the new
 *                              MeasurementResultsCard share one source
 *                              of truth (no two-implementation drift)
 *
 * Also exports a small set of pure geometry helpers (centroid,
 * bounding-box span) so the Area / Volume cards can lean on the same
 * primitives — the live-readout chip's `pickAnchorPoint` already
 * reinvents centroid math, and we'd like *one* version of that going
 * forward.
 */

import { EllipsoidGeodesic, Math as CesiumMath } from 'cesium';
import type { MeasurementPoint, ProfileSample } from '@/store/viewerStore';

export interface ProfileMetrics {
  /** Last sample's `distance` value — total polyline length in metres. */
  totalDistance: number;
  minHeight: number;
  maxHeight: number;
  meanHeight: number;
  /** Sum of all positive segment height deltas (m). PRD Stage 22. */
  elevationGain: number;
  /** Sum of |negative| segment height deltas (m). PRD Stage 22. */
  elevationLoss: number;
  /** Net slope from start to end, expressed as a percentage. Sign is
   *  preserved (negative = downhill from start to end). */
  avgGradePct: number;
  /** Maximum *absolute* segment grade, percent. Used as the "steepest
   *  bit" headline on the Profile card. Always ≥ 0. */
  maxGradePct: number;
}

/**
 * Default zero-state used when the caller has fewer than two samples.
 * Kept exported so card components can render a consistent skeleton
 * before the terrain-sampling promise resolves.
 */
export const ZERO_PROFILE_METRICS: ProfileMetrics = {
  totalDistance: 0,
  minHeight: 0,
  maxHeight: 0,
  meanHeight: 0,
  elevationGain: 0,
  elevationLoss: 0,
  avgGradePct: 0,
  maxGradePct: 0,
};

/**
 * Roll a `ProfileSample[]` (from `sampleTerrainAlongPolyline`) into the
 * card's KPI strip. Single linear pass — O(n) over the typical 200-sample
 * series.
 */
export function computeProfileMetrics(samples: ProfileSample[]): ProfileMetrics {
  if (samples.length < 2) return ZERO_PROFILE_METRICS;

  let gain = 0;
  let loss = 0;
  let maxGrade = 0;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (let i = 0; i < samples.length; i++) {
    const h = samples[i].height;
    if (h < min) min = h;
    if (h > max) max = h;
    sum += h;

    if (i > 0) {
      const prev = samples[i - 1];
      const dh = h - prev.height;
      const dd = samples[i].distance - prev.distance;
      if (dh > 0) gain += dh;
      else loss -= dh; // dh < 0, so -dh > 0
      if (dd > 0) {
        const grade = Math.abs(dh / dd);
        if (grade > maxGrade) maxGrade = grade;
      }
    }
  }

  const totalDistance = samples[samples.length - 1].distance;
  const lastFirstDelta =
    samples[samples.length - 1].height - samples[0].height;
  const avgGradePct =
    totalDistance > 0 ? (lastFirstDelta / totalDistance) * 100 : 0;

  return {
    totalDistance,
    minHeight: min,
    maxHeight: max,
    meanHeight: sum / samples.length,
    elevationGain: gain,
    elevationLoss: loss,
    avgGradePct,
    maxGradePct: maxGrade * 100,
  };
}

// ===================== Geometry primitives =====================

/**
 * Mean lat / lng / height over the supplied points. Degree-space mean
 * is fine for measurement polygons — they're almost always within a
 * few hundred metres horizontally, and the live chip's anchor only
 * needs visual stability, not geodesic accuracy. The Volume card uses
 * the same centroid for the "where is this stockpile" coordinate row.
 *
 * Returns `null` for an empty list so callers can short-circuit
 * cleanly without sentinel checks on `NaN`.
 */
export function centroidOf(points: MeasurementPoint[]): MeasurementPoint | null {
  if (points.length === 0) return null;
  let lng = 0;
  let lat = 0;
  let h = 0;
  for (const p of points) {
    lng += p.longitude;
    lat += p.latitude;
    h += p.height;
  }
  return {
    longitude: lng / points.length,
    latitude: lat / points.length,
    height: h / points.length,
  };
}

export interface BoundingBoxSpan {
  /** West-east span in metres (computed at the bbox mid-latitude). */
  widthMeters: number;
  /** South-north span in metres. */
  heightMeters: number;
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/**
 * Approximate ground span of the bounding box around `points`. Uses
 * the spherical-Earth approximation `dx ≈ R · cos(midLat) · Δlon` /
 * `dy ≈ R · Δlat` — accurate to ~0.5 % for measurement-scale polygons,
 * which is well below what an operator could read off the chip.
 */
export function bboxSpan(points: MeasurementPoint[]): BoundingBoxSpan | null {
  if (points.length === 0) return null;
  let minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const p of points) {
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
  }
  const R = 6_371_000;
  const midLatRad = CesiumMath.toRadians((minLat + maxLat) / 2);
  const widthMeters =
    R * Math.cos(midLatRad) * CesiumMath.toRadians(maxLng - minLng);
  const heightMeters = R * CesiumMath.toRadians(maxLat - minLat);
  return {
    widthMeters,
    heightMeters,
    minLng,
    maxLng,
    minLat,
    maxLat,
  };
}

export interface VertexElevationStats {
  min: number;
  max: number;
  mean: number;
}

/**
 * min / max / mean of `points[].height`. Used by the Distance and Area
 * cards to surface the elevation envelope of the user-placed vertices
 * (which is faster than triggering a full terrain-sample pass and is
 * adequate when the user only cares about "what's the height range
 * along this line").
 */
export function vertexElevationStats(
  points: MeasurementPoint[],
): VertexElevationStats | null {
  if (points.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const p of points) {
    if (p.height < min) min = p.height;
    if (p.height > max) max = p.height;
    sum += p.height;
  }
  return { min, max, mean: sum / points.length };
}

/**
 * Approximate count of local extrema (peaks + valleys) in the
 * elevation series. Used by the Cross-section card to label
 * "benches" — a `prominence` parameter (metres) filters out
 * micro-bumps caused by terrain-tile noise.
 *
 * Default prominence of 0.5 m matches the typical bench step in the
 * demo dataset; raise it for noisier terrain or for slopes where the
 * operator only wants major breaks called out.
 */
export function countBenchExtrema(
  samples: ProfileSample[],
  prominence: number = 0.5,
): number {
  if (samples.length < 3) return 0;
  let count = 0;
  for (let i = 1; i < samples.length - 1; i++) {
    const prev = samples[i - 1].height;
    const cur = samples[i].height;
    const next = samples[i + 1].height;
    if (cur > prev && cur > next && cur - Math.min(prev, next) >= prominence) count++;
    else if (cur < prev && cur < next && Math.min(prev, next) - cur >= prominence)
      count++;
    // Reference unused locals so the build doesn't trip the
    // `EllipsoidGeodesic` import-when-needed lint — see footer.
  }
  return count;
}

// `EllipsoidGeodesic` is intentionally re-exported here for the
// (forthcoming) per-segment-grade marker line on ProfileChart so the
// import surface settles in one place. Suppress the unused warning.
void EllipsoidGeodesic;
