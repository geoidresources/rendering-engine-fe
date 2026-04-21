// API response types matching rendering-engine-be Go structs

// --- Envelopes ---

// ListEnvelope mirrors the backend's paginated list shape
// (`{data, pagination}`). Every list endpoint returns this; non-list
// endpoints return their object directly.
export interface ListEnvelope<T> {
  data: T[];
  pagination: { limit: number; offset: number; total: number };
}

// --- Dashboard ---

export interface DashboardRecentProject {
  id: string;
  name: string;
  updated_at: string;
  survey_count: number;
  latest_survey_date?: string;
}

export interface DashboardAlert {
  survey_id: string;
  project_id: string;
  project_name: string;
  status: string;
  survey_date: string;
}

export interface PipelineActivityPoint {
  label: string; // "Jan", "Feb", …
  value: number;
}

export interface PipelineRow {
  project: string;
  epoch: string;
  stage: string;
  duration: string;
  status: string;
}

export interface PipelineCounts {
  complete: number;
  processing: number;
  failed: number;
}

export interface DashboardSummary {
  active_projects: number;
  total_surveys: number;
  pending_surveys: number;
  total_volume_m3: number;
  total_area_m2: number;
  alert_count: number;
  recent_projects: DashboardRecentProject[];
  recent_alerts: DashboardAlert[];
  pipeline_activity: PipelineActivityPoint[];
  pipeline_rows: PipelineRow[];
  pipeline_counts: PipelineCounts;
  pipeline_health_pct: number;
  // Period-over-period deltas computed server-side against the equal-length
  // window ending at the current window's start. Signed — negative means the
  // metric dropped. These replace the old MOCK_DELTAS fallback on /home.
  delta_active_projects: number;
  delta_total_surveys: number;
  delta_pending_surveys: number;
  delta_pipeline_health_pct: number;
}

// --- Projects ---

export interface ProjectSettings {
  coordinates?: { lat: number; lng: number };
  timezone?: string;
  crs?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string;
  settings: ProjectSettings | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  survey_count: number;
  latest_survey_date?: string;
  total_area_m2: number;
}

// --- Surveys ---

export interface Survey {
  id: string;
  client_id: string;
  project_id: string;
  survey_date: string;
  status: string;
  contract_sla_flag: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyAsset {
  id: string;
  processor_type: string;
  status: string;
  output_urls: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// --- Analytics ---

export interface StockpileRecord {
  id: string;
  pile_id: string;
  material_type: string;
  area_m2: number;
  volume_m3: number;
  adjusted_volume_m3: number;
  tonnage: number;
  delta_volume_m3: number;
  delta_tonnage: number;
  inventory_change_pct: number;
  provenance: Record<string, unknown>;
  created_at: string;
}

export interface ReconciliationRecord {
  id: string;
  material: string;
  client_opening_stock_t: number;
  client_mined_t: number;
  client_dispatched_t: number;
  mass_balance_closing_t: number;
  survey_closing_t: number;
  variance_t: number;
  variance_pct: number;
  status: string;
  period_start: string;
  period_end: string;
  provenance: Record<string, unknown>;
  created_at: string;
}

// ReconciliationSummaryThresholds shows the green/amber band that classified
// the rows in the current result set, plus whether the client has an override
// or is inheriting the seeded __default__ row. The UI tags the thresholds
// popover accordingly so operators know when they're editing vs. creating.
export interface ReconciliationSummaryThresholds {
  green_pct: number;
  amber_pct: number;
  source: "client" | "default";
}

// ReconciliationSummary replaces the client-side sum KPIs on /reconciliation.
// Returned by GET /api/v1/analytics/reconciliation/summary?project_id=<id>.
export interface ReconciliationSummary {
  total_survey_t: number;
  total_balance_t: number;
  variance_pct: number;
  flagged_count: number;
  green_count: number;
  amber_count: number;
  red_count: number;
  last_run: string | null;
  thresholds: ReconciliationSummaryThresholds;
}

// AnalyticsThreshold mirrors asset-svc's dtos.ThresholdResponse. `source` is
// "client" when the row's client_id matches the caller's, "default" when the
// handler is serving the seeded __default__ row as a fallback.
export interface AnalyticsThreshold {
  id: string;
  client_id: string;
  metric_type: string;
  green_upper_pct: number;
  amber_upper_pct: number;
  source: "client" | "default";
  updated_at: string;
}

// RunReconciliationRequest — body shape for
// POST /asset-svc/api/v1/projects/:projectId/reconciliation/run.
// `material` is optional: when omitted the server fans out one reconciliation
// per distinct material on the project.
export interface RunReconciliationRequest {
  period_start: string; // RFC3339
  period_end: string; // RFC3339
  material?: string;
  swell_factor?: number;
}

export interface RunReconciliationResponse {
  workflow_ids: string[];
  materials: string[];
  client_records_derived: number;
  opening_stock_fell_back: boolean;
  period_start: string;
  period_end: string;
}

export interface TemporalSnapshot {
  id: string;
  material: string;
  metric_type: string;
  value: number;
  trend_slope_per_day: number;
  depletion_date: string | null;
  is_anomaly: boolean;
  anomaly_z_score: number;
  anomaly_severity: string;
  variance_trend_slope: number;
  provenance: Record<string, unknown>;
  created_at: string;
}

export interface StockpileZone {
  zone: string;
  pile_count: number;
  total_volume_m3: number;
  total_tonnage: number;
  total_area_m2: number;
}

// --- Measurements ---

export interface MeasurementInventoryItem {
  id: string;
  name: string;
  feature_type: string;
  // RFC7946 GeoJSON (stringified) for the measurement's footprint geometry.
  // Sourced from `ST_AsGeoJSON(measurements.geom)` server-side. Consumers
  // that just want numbers can ignore it; the /measurements page parses it
  // to render a 3D preview of the selected stockpile without a second
  // round-trip.
  geojson: string;
  properties: Record<string, unknown> | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  volume_m3: number | null;
  tonnage: number | null;
  material_type: string | null;
  area_m2: number | null;
  // GCS URL to the per-pile GLB mesh produced by stockpile-inventory processor.
  // Empty string when the processor has not yet generated a mesh.
  mesh_url: string | null;
}

export interface MeasurementInventorySummary {
  items: MeasurementInventoryItem[];
  total_volume_m3: number;
  total_tonnage: number;
  total_area_m2: number;
  stockpile_count: number;
}

export interface MeasurementRecord {
  id: string;
  name: string;
  feature_type: string;
  geojson: string;
  properties: Record<string, unknown>;
  latest_survey_id: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

// --- Operational dashboard additions ---

// InventorySummaryResponse is the client-wide rollup returned by
// GET /api/v1/analytics/inventory/summary. Unlike MeasurementInventorySummary
// (which is survey-scoped), this aggregates across every project's latest
// survey — safe to bind to a top-level "Total Inventory" KPI.
export interface InventorySummaryResponse {
  total_volume_m3: number;
  total_tonnage: number;
  total_area_m2: number;
  stockpile_count: number;
  project_count: number;
  latest_survey_date: string | null;
}

// ActivityEvent is a single row in the unified activity feed returned by
// GET /api/v1/events/activity. Severity drives the badge colour;
// related_kind + related_id allow the row to link back to its source.
export interface ActivityEvent {
  timestamp: string;
  type: "alert" | "survey_ingest" | "project_update" | "reconciliation";
  title: string;
  subtitle: string;
  severity: "critical" | "warning" | "info";
  related_id: string;
  related_kind: "survey" | "project" | "stockpile";
}

// ProcessingStatusProcessor is a single processor-type row in the breakdown
// array returned by GET /api/v1/processing/active. Mirrors the Go struct of
// the same name in rendering-engine-be/internal/repository/reader.go.
export interface ProcessingStatusProcessor {
  processor_type: string;
  active: number;
  failed: number;
}

// ProcessingStatus replaces the retired FleetStatus stub. It is the live
// pipeline-health rollup the operator sees on the "Active processing" KPI
// — queue depth, running jobs, and 24h throughput/failures across every
// processor type for the caller's tenant.
export interface ProcessingStatus {
  active_count: number;
  queued_count: number;
  running_count: number;
  completed_24h: number;
  failed_24h: number;
  total_24h: number;
  last_completion: string | null;
  by_processor: ProcessingStatusProcessor[];
}

// ProjectMaterial is one row in the materials dropdown. `last_seen` is the
// most recent `analytics_stockpiles.created_at` for that material_type on
// the project, used to sort newest-first in the picker.
export interface ProjectMaterial {
  material: string;
  last_seen: string;
}

// MaterialsResponse is the envelope returned by
// GET /api/v1/analytics/materials?project_id=<uuid>. Short list, no
// pagination — we wrap in an object so the shape is forwards-compatible
// with future fields (e.g. preferred_default) without a breaking change.
export interface MaterialsResponse {
  materials: ProjectMaterial[];
}

// SurveyDeltaPoint is a single snapshot inside a SurveyDeltaResponse.
export interface SurveyDeltaPoint {
  survey_id: string;
  survey_date: string;
  volume_m3: number;
  tonnage: number;
}

// SurveyDeltaResponse is the fallback KPI payload returned by
// GET /api/v1/analytics/survey-delta when fewer than two rows exist in
// `analytics_temporal_snapshots` for the material. It derives the same
// latest-vs-previous delta directly from `analytics_stockpiles` grouped
// by survey, so the Last-Survey-Delta KPI populates as soon as the
// second survey is ingested — without waiting for the temporal-trends
// processor to run. `previous` is null on first survey ingest.
export interface SurveyDeltaResponse {
  latest: SurveyDeltaPoint | null;
  previous: SurveyDeltaPoint | null;
  delta_volume_m3: number;
  delta_tonnage: number;
  delta_pct: number;
  is_anomaly: boolean;
}

// DashboardSummaryParams is the optional query-string shape for
// useDashboardSummary. When both bounds are provided the backend filters
// the recent-projects, alerts, and pipeline-activity aggregates to that
// window; an omitted bound defaults server-side to (now-365d, now).
export interface DashboardSummaryParams {
  startDate?: string; // RFC3339
  endDate?: string; // RFC3339
}

// --- Users ---

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_time?: string | null;
  created_at: string;
}

// CutFillRecord is one row returned by
// GET /api/v1/analytics/cutfill?baseline=<uuid>&comparison=<uuid>.
// Each row covers one zone; diff_raster_url points to an XYZ tile set of
// the elevation-difference raster (null when the processor hasn't written
// tiles yet or the comparison pair has no raster).
//
// quality_* fields are emitted by the rendering-engine-be read-time gate
// (Cut-Fill Quality Gate Addendum) when a row trips the filename
// CRS-mismatch or extreme-depth signal. Healthy rows omit all three —
// always check `quality_suspect` first before reading the others.
export interface CutFillRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  cut_volume_m3: number;
  fill_volume_m3: number;
  net_change_m3: number;
  total_moved_m3: number;
  cut_tonnage_t: number;
  fill_tonnage_t: number;
  diff_raster_url: string | null;
  provenance: Record<string, unknown>;
  created_at: string;
  quality_suspect?: boolean;
  quality_reason?: string;
  quality_reason_code?: 'datum_mismatch' | 'extreme_depth';
}

// --- QA ---

export interface QAAuditLogEntry {
  id: string;
  survey_id: string;
  action: string;
  actor_id: string;
  actor_name: string;
  previous_status?: string;
  new_status?: string;
  comment?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface QAChecklist {
  id: string;
  survey_id: string;
  checklist: Array<{ label: string; checked: boolean }>;
  created_at: string;
  updated_at: string;
}
