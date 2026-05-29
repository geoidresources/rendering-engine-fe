// City digital twin TypeScript types — mirror asset-svc/internal/dtos/citytwin_dtos.go.
//
// Backend stores timestamps as ISO 8601 strings; we keep them as strings here
// (formatting is presentation-only, no client-side Date math needed).

export type CityTwinAssetKind =
  | "mesh"
  | "dsm"
  | "orthophoto"
  | "point_cloud"
  | "vector";

export type CityTwinAssetStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "verified"
  | "rejected"
  | "archived";

export type CityTwinConversionStatus =
  | "queued"
  | "processing"
  | "partial"
  | "complete"
  | "failed";

export interface CityTwinAsset {
  id: string;
  city_twin_id: string;
  kind: CityTwinAssetKind;
  source_format: string;
  storage_prefix: string;
  root_file: string;
  file_count: number;
  total_bytes?: number;
  status: CityTwinAssetStatus;
  manifest: Record<string, unknown>;
  rejection_reason?: string | null;
  created_at: string;
  uploaded_at?: string | null;
}

export interface CityTwinConversion {
  id: string;
  city_twin_id: string;
  workflow_id: string;
  status: CityTwinConversionStatus;
  mesh_tileset_url?: string | null;
  terrain_tileset_url?: string | null;
  ortho_tileset_url?: string | null;
  points_tileset_url?: string | null;
  vector_url?: string | null;
  smoke_test_delta?: number | null;
  asset_snapshot?: Record<string, unknown>;
  output_metadata?: Record<string, unknown>;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface CityTwin {
  id: string;
  client_id: string;
  slug: string;
  name: string;
  description?: string;
  center_lng?: number | null;
  center_lat?: number | null;
  center_height?: number | null;
  default_heading: number;
  default_pitch: number;
  source_epsg: string;
  active_conversion_id?: string | null;
  active_conversion?: CityTwinConversion | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** One row from the events log — used by polling + SSE timeline. */
export interface ConversionEvent {
  /** BIGSERIAL row id; live SSE events arrive with id=0 until persisted. */
  id: number;
  conversion_id: string;
  twin_id: string;
  /**
   * Stage of the workflow.
   *   received       — processor pulled task off NATS
   *   pulling_input  — gsutil rsync from GCS
   *   converting     — external binary running for a specific kind
   *   uploading      — gsutil push of output tileset
   *   smoke_test     — DSM vertical-datum check
   *   completed      — successful end-of-run
   *   failed         — terminal error
   */
  stage: string;
  /** Asset kind under work — empty for run-level events. */
  kind?: string;
  /** started | progress | complete | failed */
  status: string;
  message?: string;
  /** Optional 0..100 progress hint. */
  percentage?: number | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreateTwinRequest {
  slug: string;
  name: string;
  description?: string;
  center_lng?: number;
  center_lat?: number;
  center_height?: number;
  default_heading?: number;
  default_pitch?: number;
  source_epsg: string;
  metadata?: Record<string, unknown>;
}

export interface TriggerConversionResponse {
  conversion_id: string;
  workflow_id: string;
  status: CityTwinConversionStatus;
}

// ---------------------------------------------------------------------------
// Asset upload — Phase 2 (per-kind file attach to an existing twin)
// ---------------------------------------------------------------------------
// Mirrors InitAssetUploadRequest / MarkAssetUploadedRequest in
// asset-svc/internal/dtos/citytwin_dtos.go. The BE returns one signed PUT
// URL per file in the manifest (same order, same path), so the client can
// fan out the uploads in parallel without re-asking for URLs.

export interface AssetFileManifestItem {
  /** Path relative to the asset's storage_prefix. For multi-file payloads
   *  (e.g. a 3MX directory or SHP with sidecars) use forward-slash separated
   *  relative paths — e.g. "Data/Tile_+000_+000.3mxb". */
  path: string;
  size?: number;
  sha256?: string;
}

export interface InitAssetUploadRequest {
  kind: CityTwinAssetKind;
  /** Free-form per kind — e.g. "3mx", "geotiff", "las", "copc", "geojson", "shp". */
  source_format: string;
  /** Primary file relative to storage_prefix. The post-conversion processor
   *  reads this to know which file in the manifest is the entry point. */
  root_file: string;
  file_manifest: AssetFileManifestItem[];
}

export interface SignedUploadURL {
  /** Matches the corresponding manifest item's path verbatim. */
  path: string;
  /** PUT here with the headers below. */
  url: string;
  /** GCS signed URLs are header-bound — these must be sent on the PUT
   *  exactly as supplied (case + value). Typically includes Content-Type
   *  and x-goog-content-length-range. */
  headers?: Record<string, string>;
}

export interface InitAssetUploadResponse {
  asset_id: string;
  /** gs:// path; the FE doesn't use it directly. Returned for debugging /
   *  display purposes. */
  storage_prefix: string;
  signed_urls: SignedUploadURL[];
}

export interface MarkAssetUploadedRequest {
  total_bytes?: number;
  /** Optional client-side metadata blob persisted on the asset row. */
  manifest?: Record<string, unknown>;
}
