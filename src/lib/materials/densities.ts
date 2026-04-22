/**
 * Bulk density lookup table — used by the Measurement Results Card to
 * surface a *live* tonnage estimate while the user is drawing a Volume
 * polygon. Values are loose-bulk densities (t/m³) for the common mining
 * materials surfaced by `useMaterials(projectId)` and the FALLBACK list.
 *
 * IMPORTANT — this is a *frontend estimate only*.
 *
 * The authoritative tonnage comes from
 * `asset-svc.processVolumeResult()` on the backend, which has access to
 * the per-client density override table (`analytics_thresholds` analog,
 * future `analytics_material_densities`). When the operator clicks
 * "Save as stockpile", the backend recomputes tonnage and overwrites
 * the FE estimate — so the card always shows an "≈ estimate" badge to
 * make the provenance unambiguous.
 *
 * Numbers cite the standard mining-engineering ranges (Hartman & Mutmansky,
 * SME Mining Reference Handbook):
 *
 *   - coal:        1.20 – 1.50 t/m³  (loose, typical bituminous)
 *   - overburden:  1.50 – 2.00 t/m³  (mixed soil + rock)
 *   - topsoil:     1.30 – 1.60 t/m³
 *   - iron_ore:    2.30 – 2.80 t/m³  (hematite/magnetite)
 *   - waste_rock:  1.80 – 2.20 t/m³
 *   - aggregate:   1.50 – 1.70 t/m³  (crushed stone, blue metal)
 *   - sand:        1.50 – 1.70 t/m³  (loose, dry)
 *
 * We pick mid-range values; clients with strong density variance can
 * override per-stockpile via the SaveRegionModal's properties bag.
 */

export const MATERIAL_DENSITIES_T_PER_M3: Record<string, number> = {
  coal: 1.30,
  overburden: 1.80,
  topsoil: 1.50,
  iron_ore: 2.50,
  waste_rock: 2.00,
  aggregate: 1.60,
  sand: 1.60,
  unclassified: 1.80,
};

/** Used when the material is null / unknown / not in the table. */
export const DEFAULT_DENSITY_T_PER_M3 = 1.80;

/**
 * Resolve a material identifier to a density. Tolerant to:
 *  - `null` / `undefined` (returns the fallback)
 *  - case differences (the backend has historically used both
 *    `iron_ore` and `Iron Ore` depending on ingestion path)
 *  - whitespace
 */
export function densityFor(material: string | null | undefined): number {
  if (!material) return DEFAULT_DENSITY_T_PER_M3;
  const key = material.trim().toLowerCase().replace(/\s+/g, '_');
  return MATERIAL_DENSITIES_T_PER_M3[key] ?? DEFAULT_DENSITY_T_PER_M3;
}

/**
 * Compute tonnage from volume + material identifier. Pure helper for
 * the Volume card so the JSX stays declarative — tonnage is a single
 * `formatTonnage(estimateTonnage(volume, material))`.
 */
export function estimateTonnage(
  volumeM3: number,
  material: string | null | undefined,
): number {
  return volumeM3 * densityFor(material);
}

/**
 * Tonnage formatter mirroring the volume / area / distance pattern in
 * `measurementPrimitives.ts` — locale-formatted, with a unit step-up at
 * 1 kt (1 000 t) and 1 Mt (1 000 000 t) so headline values stay
 * readable without a custom font for the digit grid.
 */
export function formatTonnage(t: number): string {
  if (!Number.isFinite(t)) return '—';
  if (Math.abs(t) >= 1_000_000) return `${(t / 1_000_000).toFixed(2)} Mt`;
  if (Math.abs(t) >= 1_000) return `${(t / 1_000).toFixed(2)} kt`;
  return `${t.toFixed(0)} t`;
}

/**
 * Density formatter — used by the Volume card's "method" tooltip so
 * the user can see *exactly* which density the FE estimate used. Two
 * decimal places matches the precision of the LUT.
 */
export function formatDensity(t_per_m3: number): string {
  if (!Number.isFinite(t_per_m3)) return '—';
  return `${t_per_m3.toFixed(2)} t/m³`;
}
