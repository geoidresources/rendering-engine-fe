// useHomeDashboard fans out every read the operational /home dashboard
// needs in a single hook. The /home page is the operator's 6 AM "what broke
// overnight?" screen, so it must show loading skeletons per-section (not one
// global blocker) and tolerate partial backend failure — if, say, the trend
// endpoint returns 500, the KPIs and activity feed still render.
//
// Design choices:
//
//   - Each backend endpoint gets its own `useQuery` so TanStack can track
//     loading / error / refetch independently. The page reads the individual
//     query objects, not a merged blob.
//   - Reads that depend on a project id (`reconciliation`, `trends`,
//     `materials`, `surveyDelta`) are gated by `enabled: !!latestProjectId`
//     so they don't fire with an empty string while `summary` is still
//     resolving.
//   - Derived fields (`varianceCount`, `lastSurveyDelta`) live here rather
//     than in the page so the memoisation dependencies are scoped to the
//     data that produced them — the page can treat them as plain values.
//   - `staleTime: 60_000` keeps the dashboard snappy when the operator
//     navigates away and back; `refetchOnWindowFocus` (TanStack default)
//     brings it fresh when the tab regains focus. The `processing` query
//     gets a tighter `staleTime: 30_000` because pipeline jobs change fast.
//
// Placeholder elimination (see plan encapsulated-drifting-wirth.md):
//   - Fleet stub is gone; replaced by `processing` against
//     `/api/v1/processing/active` which aggregates real `survey_assets`
//     pipeline state.
//   - The hard-coded `material=default` is gone; the caller drives
//     `selectedMaterial` from a UI dropdown populated by the `materials`
//     query, and we thread it into the trends queryKey so changing
//     material refetches.
//   - `lastSurveyDelta` now falls back to `/api/v1/analytics/survey-delta`
//     (computed directly from `analytics_stockpiles`) when the temporal
//     snapshots table has fewer than 2 rows — so the KPI populates on
//     the second survey ingest instead of waiting for
//     temporal-trends to run.
//
// The list endpoints (`/events/activity`, `/analytics/reconciliation`,
// `/analytics/trends`) return the `{data, pagination}` envelope — we unwrap
// to a plain array here so consumers get a simple `T[] | undefined`.

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrapList } from "@/lib/http";
import { useDashboardSummary } from "@/hooks/useDashboard";
import type {
  ActivityEvent,
  DashboardSummaryParams,
  InventorySummaryResponse,
  ListEnvelope,
  MaterialsResponse,
  ProcessingStatus,
  ProjectMaterial,
  ReconciliationRecord,
  ReconciliationSummary,
  StockpileZone,
  SurveyDeltaResponse,
  TemporalSnapshot,
} from "@/types/api";

export interface LastSurveyDelta {
  absolute: number;
  pct: number;
  isAnomaly: boolean;
}

// UseHomeDashboardOptions drives the two bits of caller-owned state that
// need to round-trip back into query keys: the time window (wired to the
// Day/Week/Month/Year tabs) and the currently-selected material (wired to
// the Material dropdown in the InventoryTrendCard header). Both are
// optional; omitting them preserves the pre-range default behaviour.
export interface UseHomeDashboardOptions {
  range?: DashboardSummaryParams;
  selectedMaterial?: string;
}

export function useHomeDashboard(options: UseHomeDashboardOptions = {}) {
  const { range, selectedMaterial } = options;

  const summary = useDashboardSummary(range);

  const inventory = useQuery<InventorySummaryResponse>({
    queryKey: ["analytics", "inventory-summary"],
    queryFn: async () => {
      const res = await apiClient.get<InventorySummaryResponse>(
        "/api/v1/analytics/inventory/summary",
      );
      return res.data;
    },
    staleTime: 60_000,
  });

  const activity = useQuery<ActivityEvent[]>({
    queryKey: ["events", "activity", 50],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<ActivityEvent>>(
        "/api/v1/events/activity?limit=50",
      );
      return unwrapList(res.data);
    },
    staleTime: 60_000,
  });

  // Active-processing rollup. Tighter staleTime than the other queries
  // because pipeline job counts actually move minute-to-minute — the
  // operator will notice if this lags.
  const processing = useQuery<ProcessingStatus>({
    queryKey: ["processing", "active"],
    queryFn: async () => {
      const res = await apiClient.get<ProcessingStatus>(
        "/api/v1/processing/active",
      );
      return res.data;
    },
    staleTime: 30_000,
  });

  const latestProjectId = summary.data?.recent_projects?.[0]?.id;

  const reconciliation = useQuery<ReconciliationRecord[]>({
    queryKey: ["analytics", "reconciliation", latestProjectId],
    enabled: !!latestProjectId,
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<ReconciliationRecord>>(
        `/api/v1/analytics/reconciliation?project_id=${latestProjectId}`,
      );
      return unwrapList(res.data);
    },
    staleTime: 60_000,
  });

  // Reconciliation thresholds + totals. Drives the drift-sparkline's
  // yellow/red reference bands. The green_pct/amber_pct fields already come
  // from analytics_thresholds (client override or seeded __default__ row —
  // see ADR 014) so we don't need a second endpoint.
  const reconciliationSummary = useQuery<ReconciliationSummary>({
    queryKey: ["analytics", "reconciliation-summary", latestProjectId],
    enabled: !!latestProjectId,
    queryFn: async () => {
      const res = await apiClient.get<ReconciliationSummary>(
        `/api/v1/analytics/reconciliation/summary?project_id=${latestProjectId}`,
      );
      return res.data;
    },
    staleTime: 60_000,
  });

  // Per-zone stockpile rollup. Populates the Zone Health Strip. Single-zone
  // tenants will get a 1-element list; the UI hides the strip in that case.
  const zoneHealth = useQuery<StockpileZone[]>({
    queryKey: ["analytics", "stockpiles", "by-zone", latestProjectId],
    enabled: !!latestProjectId,
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<StockpileZone>>(
        `/api/v1/analytics/stockpiles/by-zone?project_id=${latestProjectId}`,
      );
      return unwrapList(res.data);
    },
    staleTime: 60_000,
  });

  // Materials dropdown feed. Returns an object envelope (not a list
  // envelope) — short tail, no pagination. The page lifts the currently
  // selected material into its own state and passes it back via the
  // `selectedMaterial` option.
  //
  // NOTE: queryFn unwraps to `ProjectMaterial[]` so the cache shape
  // matches `useMaterials` (same queryKey). Earlier this hook cached the
  // full `{materials: [...]}` envelope and the viewer's RightRail crashed
  // with `materialsList.slice is not a function` whenever the home page
  // had been visited first. Keep these two hooks shape-aligned.
  const materials = useQuery<ProjectMaterial[]>({
    queryKey: ["analytics", "materials", latestProjectId],
    enabled: !!latestProjectId,
    queryFn: async () => {
      const res = await apiClient.get<MaterialsResponse>(
        `/api/v1/analytics/materials?project_id=${latestProjectId}`,
      );
      return res.data?.materials ?? [];
    },
    staleTime: 5 * 60_000,
  });

  // Derive the effective material: the caller's explicit selection, or the
  // first result from the materials query. If neither is available the
  // trends query stays disabled so we don't fire a request that the
  // backend would reject as bad-request.
  const effectiveMaterial = useMemo(() => {
    if (selectedMaterial) return selectedMaterial;
    return materials.data?.[0]?.material;
  }, [selectedMaterial, materials.data]);

  // Derive the trend window from the caller's range (falls back to
  // last 365 days to match the server default). Keeping this here means
  // the page's Tabs.onValueChange can focus on translating the tab into
  // a range — the query wiring lives beside the other derivations.
  const trendStartISO = range?.startDate;
  const trendEndISO = range?.endDate;

  const trends = useQuery<TemporalSnapshot[]>({
    queryKey: [
      "analytics",
      "trends",
      latestProjectId,
      effectiveMaterial,
      trendStartISO ?? null,
      trendEndISO ?? null,
    ],
    enabled: !!latestProjectId && !!effectiveMaterial,
    queryFn: async () => {
      const qs = new URLSearchParams({
        project_id: latestProjectId!,
        material: effectiveMaterial!,
      });
      if (trendStartISO) qs.set("start_date", trendStartISO);
      if (trendEndISO) qs.set("end_date", trendEndISO);
      const res = await apiClient.get<ListEnvelope<TemporalSnapshot>>(
        `/api/v1/analytics/trends?${qs.toString()}`,
      );
      return unwrapList(res.data);
    },
    staleTime: 60_000,
  });

  // Survey-delta fallback. We only hit the endpoint when the trends query
  // has resolved with < 2 points — no point burning a request when the
  // temporal snapshots already cover the KPI. The backend itself also
  // handles the empty-material case (returns `latest: null`), so we can
  // run it with only a project id when the material picker is empty.
  const trendsFetched = trends.isSuccess || trends.isError;
  const needsDeltaFallback =
    !!latestProjectId && trendsFetched && (trends.data?.length ?? 0) < 2;

  const surveyDelta = useQuery<SurveyDeltaResponse>({
    queryKey: [
      "analytics",
      "survey-delta",
      latestProjectId,
      effectiveMaterial ?? null,
    ],
    enabled: needsDeltaFallback,
    queryFn: async () => {
      const qs = new URLSearchParams({ project_id: latestProjectId! });
      if (effectiveMaterial) qs.set("material", effectiveMaterial);
      const res = await apiClient.get<SurveyDeltaResponse>(
        `/api/v1/analytics/survey-delta?${qs.toString()}`,
      );
      return res.data;
    },
    staleTime: 60_000,
  });

  const varianceCount = useMemo(() => {
    return (reconciliation.data ?? []).filter((r) => r.status !== "ok").length;
  }, [reconciliation.data]);

  // lastSurveyDelta: prefer the temporal-snapshots series (richer signal,
  // carries the anomaly z-score). Fall back to the direct survey-delta
  // endpoint so the KPI populates as soon as two surveys exist — no need
  // to wait on the trends processor. `null` only when both sources are
  // empty (first-ever survey on the tenant).
  const lastSurveyDelta = useMemo<LastSurveyDelta | null>(() => {
    const s = trends.data ?? [];
    if (s.length >= 2) {
      const prev = s[s.length - 2];
      const latest = s[s.length - 1];
      const absolute = latest.value - prev.value;
      const pct = prev.value !== 0 ? (absolute / prev.value) * 100 : 0;
      return { absolute, pct, isAnomaly: !!latest.is_anomaly };
    }
    const sd = surveyDelta.data;
    if (sd && sd.latest && sd.previous) {
      return {
        absolute: sd.delta_volume_m3,
        pct: sd.delta_pct,
        isAnomaly: sd.is_anomaly,
      };
    }
    return null;
  }, [trends.data, surveyDelta.data]);

  // The first useEffect ensures we don't hold onto a stale
  // `selectedMaterial` when the project changes — the page clears its
  // local selection whenever `latestProjectId` shifts, but if the caller
  // passed `selectedMaterial` directly we at least log a hint so they
  // know it may not be present in the new project. Dev-only; silent
  // in prod.
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      selectedMaterial &&
      materials.data &&
      materials.data.length > 0 &&
      !materials.data.some((m) => m.material === selectedMaterial)
    ) {
      console.warn(
        `[useHomeDashboard] selectedMaterial=${selectedMaterial} is not in the materials list for project ${latestProjectId}`,
      );
    }
  }, [selectedMaterial, materials.data, latestProjectId]);

  return {
    summary,
    inventory,
    activity,
    processing,
    reconciliation,
    reconciliationSummary,
    zoneHealth,
    materials,
    trends,
    surveyDelta,
    varianceCount,
    lastSurveyDelta,
    latestProjectId,
    effectiveMaterial,
  };
}
