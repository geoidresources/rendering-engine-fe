import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assetSvcClient } from '@/lib/http';

/**
 * Asset-svc supported feature_type values, mirrored from
 * `asset-svc/internal/dtos/measurement_dtos.go` validate tag:
 *   `oneof=stockpile cutfill_zone haul_road highwall design_zone`
 *
 * The viewer's "Draw region" tool persists every drawn polygon as a
 * `stockpile`. Other feature types are reserved for future tools
 * (cut/fill clipping zones, haul-road centrelines, etc.).
 */
export type MeasurementFeatureType =
  | 'stockpile'
  | 'cutfill_zone'
  | 'haul_road'
  | 'highwall'
  | 'design_zone';

export interface CreateMeasurementBody {
  project_id: string;
  name: string;
  feature_type: MeasurementFeatureType;
  /**
   * GeoJSON geometry — the polygon ring is `[[lng, lat], …, lng0, lat0]`
   * with the first vertex repeated to close the ring (server-side
   * validators reject open rings).
   */
  geojson: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
  properties?: Record<string, unknown>;
}

export interface MeasurementResponse {
  id: string;
  client_id: string;
  project_id: string;
  name: string;
  feature_type: string;
  geojson?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  latest_survey_id?: string;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Lists every measurement (drawn region, manual annotation, etc.) for
 * a project. The Measurements tab in the right rail consumes this so
 * users can re-select / fly to / delete drawn regions.
 *
 * Endpoint: GET /asset-svc/api/v1/measurements/?project_id=<uuid>
 */
export function useMeasurementsList(projectId: string | null | undefined) {
  return useQuery<MeasurementResponse[]>({
    queryKey: ['measurements', 'list', projectId],
    queryFn: async () => {
      const res = await assetSvcClient.get<MeasurementResponse[]>(
        `/asset-svc/api/v1/measurements/?project_id=${encodeURIComponent(projectId!)}`,
      );
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

/**
 * Persists a drawn polygon to asset-svc. On success the matching list
 * query is invalidated so the right-rail Measurements tab refreshes
 * automatically; the analytics/stockpiles query is also nudged so the
 * canvas polygon layer eventually flips from outline-only to filled
 * once the workflow processor catches up.
 */
export function useCreateMeasurement(projectId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation<MeasurementResponse, Error, CreateMeasurementBody>({
    mutationKey: ['measurements', 'create', projectId],
    mutationFn: async (body) => {
      const res = await assetSvcClient.post<MeasurementResponse, CreateMeasurementBody>(
        '/asset-svc/api/v1/measurements/',
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['measurements', 'list', projectId] });
      qc.invalidateQueries({ queryKey: ['analytics', 'stockpiles'] });
    },
  });
}

export function useDeleteMeasurement(projectId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationKey: ['measurements', 'delete', projectId],
    mutationFn: async (id) => {
      await assetSvcClient.delete(`/asset-svc/api/v1/measurements/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['measurements', 'list', projectId] });
    },
  });
}
