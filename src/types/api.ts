// API response types matching rendering-engine-be Go structs

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
  properties: Record<string, unknown> | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  volume_m3: number | null;
  tonnage: number | null;
  material_type: string | null;
  area_m2: number | null;
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
