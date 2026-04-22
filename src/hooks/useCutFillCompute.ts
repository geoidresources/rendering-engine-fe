import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/http';

/**
 * BE-B — Ad-hoc cut/fill compute on an operator-drawn polygon.
 *
 * The Volume card's "Compare with last survey" button submits a polygon +
 * two survey ids and gets back a `workflow_id`. The same workflow_id is
 * then polled every 2s via `useCutFillComputeStatus` until status flips
 * to 'complete' or 'failed' — at which point the card surfaces cut/fill
 * chips inline alongside the live volume estimate.
 *
 * Endpoints (rendering-engine-be):
 *   POST /api/v1/analytics/cutfill/compute      → { workflow_id, status }
 *   GET  /api/v1/analytics/cutfill/compute/:id  → CutFillComputeRow
 *
 * Why two hooks rather than one mutation that auto-polls: TanStack
 * Query's mutation API has no built-in polling story, and the typical
 * UX pattern is "submit → store workflow_id in component state → render
 * a polling query keyed off it." That keeps the polling subscription
 * declarative (auto-stops when the component unmounts or workflow_id
 * goes back to null) without us reinventing setInterval lifecycles.
 */

// Mirrors rendering-engine-be/internal/handlers/cutfill_adhoc.go
// SubmitCutFillRequest. The optional pass-throughs (noise threshold,
// density, swell) stay zero today — the FE doesn't surface a material
// picker on the Compare flow yet, so the processor returns volume only,
// no tonnage. Wired here so the future picker is a one-line caller
// change, not a hook signature change.
export interface CutFillComputeBody {
  project_id: string;
  baseline_survey_id: string;
  comparison_survey_id: string;
  /** GeoJSON Geometry, Feature, or FeatureCollection. */
  polygon_geojson: Record<string, unknown>;
  noise_threshold_m?: number;
  bulk_density_t_m3?: number;
  swell_factor?: number;
}

export interface CutFillComputeAcceptedResponse {
  workflow_id: string;
  status: 'queued';
}

// Mirrors rendering-engine-be/internal/repository/reader.go CutFillAdhocRow
// plus the cutFillAdhocResponse wrapper in cutfill_adhoc.go (the wrapper
// embeds the row pointer, so quality_* fields appear at the top level).
// `null` is what pgx surfaces for the not-yet-set columns while the
// workflow is queued/processing; the card only renders the metrics when
// status === 'complete'.
//
// quality_* fields are emitted by the rendering-engine-be read-time gate
// (Cut-Fill Quality Gate Addendum) only when status === 'complete' and
// at least one signal trips. Healthy rows omit all three.
// footprint_area_m2 is a derived column computed at SELECT time from the
// polygon_geojson via PostGIS; it feeds the gate and is exposed to the FE
// for diagnostic chips.
export interface CutFillComputeRow {
  workflow_id: string;
  client_id: string;
  project_id: string;
  baseline_survey_id: string;
  comparison_survey_id: string;
  polygon_geojson: Record<string, unknown> | null;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  cut_volume_m3: number | null;
  fill_volume_m3: number | null;
  net_change_m3: number | null;
  sample_count: number | null;
  diff_raster_url: string | null;
  error: string | null;
  footprint_area_m2?: number;
  created_at: string;
  completed_at: string | null;
  quality_suspect?: boolean;
  quality_reason?: string;
  quality_reason_code?: 'datum_mismatch' | 'extreme_depth';
}

/**
 * Submits an ad-hoc cut/fill compute. Returns the standard TanStack
 * mutation surface; the caller stores `data.workflow_id` and feeds it
 * back into `useCutFillComputeStatus` for polling.
 */
export function useCutFillComputeSubmit() {
  const qc = useQueryClient();
  return useMutation<CutFillComputeAcceptedResponse, Error, CutFillComputeBody>({
    mutationKey: ['analytics', 'cutfill-compute', 'submit'],
    mutationFn: async (body) => {
      const res = await apiClient.post<
        CutFillComputeAcceptedResponse,
        CutFillComputeBody
      >('/api/v1/analytics/cutfill/compute', body);
      return res.data;
    },
    onSuccess: (data) => {
      // Pre-seed the polling query with the queued shell so the UI can
      // render a "queued" chip immediately without waiting for the
      // first GET round-trip.
      qc.setQueryData<CutFillComputeRow>(
        ['analytics', 'cutfill-compute', data.workflow_id],
        (prev) =>
          prev ?? {
            workflow_id: data.workflow_id,
            client_id: '',
            project_id: '',
            baseline_survey_id: '',
            comparison_survey_id: '',
            polygon_geojson: null,
            status: 'queued',
            cut_volume_m3: null,
            fill_volume_m3: null,
            net_change_m3: null,
            sample_count: null,
            diff_raster_url: null,
            error: null,
            created_at: new Date().toISOString(),
            completed_at: null,
          },
      );
    },
  });
}

/**
 * Polls the cut/fill compute status every 2s until terminal. The query
 * is disabled until a `workflow_id` is supplied; refetch interval flips
 * to `false` once status is 'complete' or 'failed' so we don't keep
 * hammering the endpoint after the result lands.
 *
 * Polling cadence (2s) mirrors the existing measurement-mesh poll in
 * `useMeasurementMesh` — operators expect snappy feedback, and the
 * typical compute is 5–15s so a 2s poll surfaces the result on average
 * within ~1s of completion without burning more than 4–8 round trips.
 */
export function useCutFillComputeStatus(
  workflowId: string | null | undefined,
) {
  return useQuery<CutFillComputeRow>({
    queryKey: ['analytics', 'cutfill-compute', workflowId],
    queryFn: async () => {
      const res = await apiClient.get<CutFillComputeRow>(
        `/api/v1/analytics/cutfill/compute/${encodeURIComponent(workflowId!)}`,
      );
      return res.data;
    },
    enabled: !!workflowId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'complete' || status === 'failed') return false;
      return 2_000;
    },
    // No staleTime — every poll should hit the network until terminal.
    staleTime: 0,
  });
}
