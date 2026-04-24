/**
 * V-TRUST-01 — quantified accuracy band for volume cards.
 *
 * The card reports `netVol ± εm³ (≈ εpct% @ 95% CI)` so operators see the
 * uncertainty envelope next to the headline instead of a binary
 * High/Med/Low chip. The formula is the classical propagated-sampling
 * error over a regular grid:
 *
 *     ε_m³ = 1.96 · √N · RMSE · cell_area_m²
 *
 * where `1.96` is the 95 % normal multiplier, `N` is the number of
 * terrain samples the volume was integrated over, RMSE is the terrain
 * surface's per-sample vertical error (metres) and `cell_area_m²` is
 * the polygon area divided by N — the area each sample "owns".
 *
 * The RMSE input comes from (in priority order):
 *
 *   1. The live survey manifest metadata (wired in Sprint-2).
 *   2. `NEXT_PUBLIC_VIEWER_DSM_RMSE_M` / `_DTM_RMSE_M` env overrides.
 *   3. Baked-in fallbacks — 0.15 m for DSM photogrammetry, 0.30 m
 *      for DTM/lidar — per the Sprint-1 design decision (D-4).
 *
 * Kept in `lib/viewer/` (not `cesium/`) because the math is terrain-
 * agnostic and reused by cards that never touch a viewer.
 */
import type { TerrainMode } from '@/store/viewerStore';

const Z_95 = 1.96;

const DEFAULT_RMSE_M: Record<TerrainMode, number> = {
  dsm: 0.15,
  dtm: 0.3,
};

/** Resolve the per-sample RMSE for the active terrain mode. Env vars
 *  override the Sprint-1 defaults; malformed values silently fall back. */
export function rmseForTerrain(mode: TerrainMode): number {
  const override =
    mode === 'dsm'
      ? process.env.NEXT_PUBLIC_VIEWER_DSM_RMSE_M
      : process.env.NEXT_PUBLIC_VIEWER_DTM_RMSE_M;
  if (override) {
    const n = Number(override);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_RMSE_M[mode];
}

export interface VolumeErrorEstimate {
  /** Absolute 95 %-CI half-width in m³ (the `±` value). */
  m3: number;
  /** Same width as a percentage of |netVol|. `null` when `netVol` is
   *  too close to zero for the ratio to be meaningful. */
  pct: number | null;
}

/** Compute the accuracy band. Returns `{ m3: 0, pct: null }` for
 *  degenerate inputs (zero samples, zero area) so callers can render a
 *  dash instead of a spurious "± 0 %". */
export function estimateVolumeError(args: {
  sampleCount: number;
  polygonAreaM2: number;
  netVolM3: number;
  rmseM: number;
}): VolumeErrorEstimate {
  const { sampleCount, polygonAreaM2, netVolM3, rmseM } = args;
  if (sampleCount <= 0 || polygonAreaM2 <= 0 || rmseM <= 0) {
    return { m3: 0, pct: null };
  }
  const cellArea = polygonAreaM2 / sampleCount;
  const m3 = Z_95 * Math.sqrt(sampleCount) * rmseM * cellArea;
  const absNet = Math.abs(netVolM3);
  const pct = absNet > 1 ? (m3 / absNet) * 100 : null;
  return { m3, pct };
}

/** Friendly label for the chip colour/tone. Kept alongside the math so
 *  callers don't re-derive thresholds — the card uses both. */
export function toneForErrorPct(pct: number | null): 'high' | 'med' | 'low' {
  if (pct === null) return 'low';
  if (pct <= 5) return 'high';
  if (pct <= 15) return 'med';
  return 'low';
}
