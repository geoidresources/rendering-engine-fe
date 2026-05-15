// TypeScript types matching asset-svc Go DTOs

// --- Signed URL ---

export interface GetSignedUrlRequest {
  file_name: string;
  asset_id: string;
  type: string;
}

export interface GetSignedUrlResponse {
  signedURL: string;
  resourceURL: string;
}

// --- Asset CRUD ---

export interface CreateAssetRequest {
  name: string;
  type: "orthophoto" | "terrain" | "point_cloud" | "archive" | "vector" | "site_model";
  asset_url: string;
  project_id: string;
}

export interface CreateAssetResponse {
  message: string;
  id: string;
}

// --- Survey CRUD (asset-svc) ---

export interface CreateSurveyRequest {
  project_id: string;
  survey_date: string;
  contract_sla_flag?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AssetSvcSurveyResponse {
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

export interface LinkAssetsRequest {
  survey_asset_ids: string[];
}

// --- Client-side upload tracking ---

export type FileUploadStatus =
  | "queued"
  | "signing"
  | "uploading"
  | "creating"
  | "processing"
  | "complete"
  | "error";

export interface FileUploadState {
  file: File;
  status: FileUploadStatus;
  progress: number;
  speed: number;
  bytesUploaded: number;
  assetId?: string;
  resourceUrl?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Virtual Surveyor parity — Phase 0 domain types
// ---------------------------------------------------------------------------
// Match the Go DTOs at BE/asset-svc/internal/dtos/{survey_point,breakline,
// survey_surface,terrain_modifier,design_feature}_dtos.go. Phase 0 wires
// CRUD stubs only; later phases populate the workflow chains.

export type SurveyPointSource =
  | "manual"
  | "import-csv"
  | "grid-rect"
  | "grid-tri"
  | "grid-lowpass"
  | "grid-qpoints"
  | "vertex-add";

export type DraftStatus = "draft" | "published";

export interface SurveyPoint {
  id: string;
  client_id: string;
  project_id: string;
  survey_id: string;
  longitude: number;
  latitude: number;
  height: number;
  code?: string;
  source: SurveyPointSource;
  status: DraftStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSurveyPointRequest {
  project_id: string;
  survey_id: string;
  longitude: number;
  latitude: number;
  height: number;
  code?: string;
  source?: SurveyPointSource;
}

export type BreaklineKind = "soft" | "hard" | "boundary" | "contour-constraint";
export type BreaklineSource = "manual" | "import-csv" | "guided-steepest" | "planimetric-snap";

export interface Breakline {
  id: string;
  client_id: string;
  project_id: string;
  survey_id: string;
  geojson: GeoJSON.LineString;
  kind: BreaklineKind;
  source: BreaklineSource;
  surface_id?: string;
  status: DraftStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBreaklineRequest {
  project_id: string;
  survey_id: string;
  geojson: GeoJSON.LineString;
  kind: BreaklineKind;
  source?: BreaklineSource;
  surface_id?: string;
}

export type SurfacePurpose = "working" | "reference" | "published";
export type SurfaceStatus = "queued" | "processing" | "complete" | "failed";

export interface SurveySurface {
  id: string;
  client_id: string;
  project_id: string;
  survey_id: string;
  name?: string;
  purpose: SurfacePurpose;
  status: SurfaceStatus;
  tin_url?: string;
  contour_url?: string;
  topology?: Record<string, unknown>;
  bounds_geojson?: GeoJSON.Polygon;
  point_count: number;
  breakline_count: number;
  contour_interval_m?: number;
  workflow_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSurveySurfaceRequest {
  project_id: string;
  survey_id: string;
  name?: string;
  purpose?: SurfacePurpose;
  point_ids?: string[];
  breakline_ids?: string[];
  boundary_id?: string;
  contour_interval_m?: number;
}

export type TerrainModifierMode = "remove-object" | "replace-terrain" | "modify-terrain";

export interface TerrainModifier {
  id: string;
  client_id: string;
  project_id: string;
  survey_id: string;
  geojson: GeoJSON.Polygon;
  mode: TerrainModifierMode;
  params: Record<string, unknown>;
  mesh_url?: string;
  active: boolean;
  ordinal: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTerrainModifierRequest {
  project_id: string;
  survey_id: string;
  geojson: GeoJSON.Polygon;
  mode: TerrainModifierMode;
  params?: Record<string, unknown>;
  active?: boolean;
  ordinal?: number;
}

export type DesignFeatureKind = "graded-road" | "flat-pad" | "water-pond" | "embankment-wall";
export type DesignFeatureStatus = "draft" | "queued" | "processing" | "complete" | "failed";

export interface DesignFeature {
  id: string;
  client_id: string;
  project_id: string;
  survey_id: string;
  name?: string;
  kind: DesignFeatureKind;
  geojson: GeoJSON.Geometry;
  params: Record<string, unknown>;
  glb_url?: string;
  tin_url?: string;
  cutfill_id?: string;
  status: DesignFeatureStatus;
  workflow_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDesignFeatureRequest {
  project_id: string;
  survey_id: string;
  name?: string;
  kind: DesignFeatureKind;
  geojson: GeoJSON.Geometry;
  params?: Record<string, unknown>;
}
