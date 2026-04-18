import { useQuery } from '@tanstack/react-query';
import { apiClient, unwrapList } from '@/lib/http';
import type { ListEnvelope, CutFillRecord } from '@/types/api';

/**
 * Fetches cut/fill analytics for a baseline → comparison survey pair.
 *
 * Returns a standard TanStack Query result whose `data` is a flat array of
 * `CutFillRecord` rows (one per zone). The query is disabled until both
 * survey IDs are non-null so callers never see a 400 from the endpoint.
 *
 * Endpoint: GET /api/v1/analytics/cutfill?baseline=<uuid>&comparison=<uuid>
 */
export function useCutFill(
  baseline: string | null,
  comparison: string | null,
) {
  return useQuery({
    queryKey: ['analytics', 'cutfill', baseline, comparison],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<CutFillRecord>>(
        `/api/v1/analytics/cutfill?baseline=${encodeURIComponent(baseline!)}&comparison=${encodeURIComponent(comparison!)}&limit=500`,
      );
      return unwrapList<CutFillRecord>(res.data);
    },
    enabled: !!baseline && !!comparison,
    staleTime: 60_000,
  });
}
