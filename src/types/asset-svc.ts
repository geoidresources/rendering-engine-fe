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
