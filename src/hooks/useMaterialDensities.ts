import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/http';

/**
 * One row from the per-tenant material density table
 * (`analytics_material_densities`, BE-A addendum).
 *
 * `source` is the provenance the backend assigns:
 *   - `'client'` — the row was overridden for the caller's tenant.
 *   - `'default'` — the row falls back to the seeded `__default__` LUT.
 *
 * The MeasurementResultsCard surfaces this as a badge so operators can
 * tell when their override has actually taken effect server-side.
 */
export interface MaterialDensity {
  material: string;
  bulk_density_t_m3: number;
  swell_factor: number;
  source: 'client' | 'default';
  updated_at: string;
}

interface MaterialDensitiesResponse {
  densities: MaterialDensity[];
}

/**
 * Fetches the live per-tenant material density rows so the
 * MeasurementResultsCard's tonnage estimate reflects the same numbers
 * the backend processors will use on Save (and not the offline-first
 * LUT in `src/lib/materials/densities.ts`).
 *
 * Endpoint: GET /api/v1/analytics/material-densities
 *
 * The endpoint is read-only and tenant-scoped (caller's `client_id`
 * comes from the JWT). Empty `material` returns every row visible to
 * the tenant — tenant overrides win over `__default__` rows on a
 * per-material basis. The response is `{ densities: [] }` only on a
 * brand-new deployment where the migration's seed rows haven't run;
 * the card falls back to the offline LUT in that case.
 *
 * staleTime mirrors `useMaterials` (5 min): operators rarely change
 * densities mid-session, and the card already refreshes on remount
 * when they reopen the InspectorTab.
 */
export function useMaterialDensities() {
  return useQuery<MaterialDensity[]>({
    queryKey: ['analytics', 'material-densities'],
    queryFn: async () => {
      const res = await apiClient.get<MaterialDensitiesResponse>(
        '/api/v1/analytics/material-densities',
      );
      // Same defensive unwrap as useMaterials — tolerate either
      // envelope-shaped or bare-array responses, return [] on
      // anything weird so consumers can call .find/.map safely.
      const raw: unknown = res.data;
      if (Array.isArray(raw)) return raw as MaterialDensity[];
      if (
        raw &&
        typeof raw === 'object' &&
        Array.isArray((raw as { densities?: unknown }).densities)
      ) {
        return (raw as MaterialDensitiesResponse).densities;
      }
      return [];
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Resolves the bulk density for a material using the server response
 * when available, falling back to the offline LUT otherwise. Returns
 * `{ density, source }` so callers can render a provenance badge.
 *
 * `source` semantics:
 *   - `'server-client'` — server row exists, sourced from a tenant override.
 *   - `'server-default'` — server row exists, sourced from the seeded `__default__`.
 *   - `'lut'` — server query hasn't resolved yet, or the material isn't in the table.
 */
export function resolveDensity(
  material: string | null | undefined,
  rows: MaterialDensity[] | undefined,
  fallback: number,
): { density: number; source: 'server-client' | 'server-default' | 'lut' } {
  if (!material || !rows || rows.length === 0) {
    return { density: fallback, source: 'lut' };
  }
  const hit = rows.find((r) => r.material === material);
  if (!hit) return { density: fallback, source: 'lut' };
  return {
    density: hit.bulk_density_t_m3,
    source: hit.source === 'client' ? 'server-client' : 'server-default',
  };
}
