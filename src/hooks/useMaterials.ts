import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/http';
import type { MaterialsResponse, ProjectMaterial } from '@/types/api';

import { toast } from "sonner";

/**
 * Fetches the material dropdown for the SaveRegionModal.
 *
 * Endpoint: GET /api/v1/analytics/materials?project_id=<uuid>
 *
 * The endpoint returns the distinct material_type values that have
 * actually been seen on this project's stockpiles, sorted by recency.
 * If the project has no stockpiles yet (first-time draw on a brand-new
 * site) the response is `{ materials: [] }` — callers should fall back
 * to the static MVP list (`coal`, `overburden`, `topsoil`, etc.).
 */
export function useMaterials(projectId: string | null | undefined) {
  return useQuery<ProjectMaterial[]>({
    queryKey: ['analytics', 'materials', projectId],
    queryFn: async () => {
      try {
        const res = await apiClient.get<MaterialsResponse>(
          `/api/v1/analytics/materials?project_id=${encodeURIComponent(projectId!)}`,
        );
        // Defensive: `useHomeDashboard` shares this exact queryKey
        // (`['analytics', 'materials', projectId]`) and is now also
        // unwrapped to `ProjectMaterial[]` — but if a future caller ever
        // re-introduces an envelope-shaped queryFn against the same key,
        // the cache hand-off would crash this consumer with
        // `materialsList.slice is not a function`. The guard below
        // tolerates either shape and returns `[]` on anything weird so
        // consumers can call `.slice` / `.map` without runtime checks.
        const raw: unknown = res.data;
        if (Array.isArray(raw)) return raw as ProjectMaterial[];
        if (
          raw &&
          typeof raw === 'object' &&
          Array.isArray((raw as { materials?: unknown }).materials)
        ) {
          return (raw as MaterialsResponse).materials;
        }
        return [];
      } catch (e) {
        console.error("Failed to fetch materials:", e);
        toast.error("Failed to load materials. Stockpile features may be limited.");
        throw e;
      }
    },
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Static fallback used when the project has no stockpiles yet. */
export const FALLBACK_MATERIALS: string[] = [
  'coal',
  'overburden',
  'topsoil',
  'iron_ore',
  'waste_rock',
  'aggregate',
  'sand',
  'unclassified',
];
