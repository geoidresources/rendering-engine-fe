import { assetSvcClient } from "@/lib/http";
import type {
  GetSignedUrlRequest,
  GetSignedUrlResponse,
  CreateAssetRequest,
  CreateAssetResponse,
  CreateSurveyRequest,
  AssetSvcSurveyResponse,
  SurveyPoint,
  CreateSurveyPointRequest,
  Breakline,
  CreateBreaklineRequest,
  SurveySurface,
  CreateSurveySurfaceRequest,
  TerrainModifier,
  CreateTerrainModifierRequest,
  DesignFeature,
  CreateDesignFeatureRequest,
} from "@/types/asset-svc";

export async function getSignedUrl(body: GetSignedUrlRequest): Promise<GetSignedUrlResponse> {
  const res = await assetSvcClient.post<GetSignedUrlResponse, GetSignedUrlRequest>(
    "/asset-svc/api/v1/user/signedurl",
    body,
  );
  return res.data;
}

export async function createAsset(body: CreateAssetRequest): Promise<CreateAssetResponse> {
  const res = await assetSvcClient.post<CreateAssetResponse, CreateAssetRequest>(
    "/asset-svc/api/v1/user/",
    body,
  );
  return res.data;
}

export async function triggerGenerate(assetId: string): Promise<void> {
  await assetSvcClient.post("/asset-svc/api/v1/user/generate/" + assetId);
}

export async function createSurvey(body: CreateSurveyRequest): Promise<AssetSvcSurveyResponse> {
  const res = await assetSvcClient.post<AssetSvcSurveyResponse, CreateSurveyRequest>(
    "/asset-svc/api/v1/surveys/",
    body,
  );
  return res.data;
}

export async function linkAssetsToSurvey(surveyId: string, assetIds: string[]): Promise<void> {
  await assetSvcClient.post("/asset-svc/api/v1/surveys/" + surveyId + "/assets", {
    survey_asset_ids: assetIds,
  });
}

// ---------------------------------------------------------------------------
// Virtual Surveyor parity — Phase 0 domain endpoints
// ---------------------------------------------------------------------------
// Match the Gin routes in BE/asset-svc/internal/interfaces/http/{survey_point,
// breakline,survey_surface,terrain_modifier,design_feature}_handler.go. Bulk
// create / grid generation paths are reserved for Phase 1+ — the BE returns
// 501 today.

// --- Survey points ---

export async function listSurveyPoints(surveyId: string): Promise<SurveyPoint[]> {
  const res = await assetSvcClient.get<SurveyPoint[]>(
    `/asset-svc/api/v1/survey-points/?survey_id=${encodeURIComponent(surveyId)}`,
  );
  return res.data ?? [];
}

export async function createSurveyPoint(body: CreateSurveyPointRequest): Promise<SurveyPoint> {
  const res = await assetSvcClient.post<SurveyPoint, CreateSurveyPointRequest>(
    "/asset-svc/api/v1/survey-points/",
    body,
  );
  return res.data;
}

export async function getSurveyPoint(id: string): Promise<SurveyPoint> {
  const res = await assetSvcClient.get<SurveyPoint>(
    `/asset-svc/api/v1/survey-points/${encodeURIComponent(id)}`,
  );
  return res.data;
}

export async function deleteSurveyPoint(id: string): Promise<void> {
  await assetSvcClient.delete(`/asset-svc/api/v1/survey-points/${encodeURIComponent(id)}`);
}

// --- Breaklines ---

export async function listBreaklines(surveyId: string): Promise<Breakline[]> {
  const res = await assetSvcClient.get<Breakline[]>(
    `/asset-svc/api/v1/breaklines/?survey_id=${encodeURIComponent(surveyId)}`,
  );
  return res.data ?? [];
}

export async function createBreakline(body: CreateBreaklineRequest): Promise<Breakline> {
  const res = await assetSvcClient.post<Breakline, CreateBreaklineRequest>(
    "/asset-svc/api/v1/breaklines/",
    body,
  );
  return res.data;
}

export async function deleteBreakline(id: string): Promise<void> {
  await assetSvcClient.delete(`/asset-svc/api/v1/breaklines/${encodeURIComponent(id)}`);
}

// --- Survey surfaces (TIN) ---

export async function listSurveySurfaces(surveyId: string): Promise<SurveySurface[]> {
  const res = await assetSvcClient.get<SurveySurface[]>(
    `/asset-svc/api/v1/surfaces/?survey_id=${encodeURIComponent(surveyId)}`,
  );
  return res.data ?? [];
}

export async function createSurveySurface(body: CreateSurveySurfaceRequest): Promise<SurveySurface> {
  const res = await assetSvcClient.post<SurveySurface, CreateSurveySurfaceRequest>(
    "/asset-svc/api/v1/surfaces/",
    body,
  );
  return res.data;
}

export async function getSurveySurface(id: string): Promise<SurveySurface> {
  const res = await assetSvcClient.get<SurveySurface>(
    `/asset-svc/api/v1/surfaces/${encodeURIComponent(id)}`,
  );
  return res.data;
}

export async function recomputeSurveySurface(id: string): Promise<SurveySurface> {
  const res = await assetSvcClient.post<SurveySurface>(
    `/asset-svc/api/v1/surfaces/${encodeURIComponent(id)}/recompute`,
  );
  return res.data;
}

// --- Terrain modifiers ---

export async function listTerrainModifiers(surveyId: string): Promise<TerrainModifier[]> {
  const res = await assetSvcClient.get<TerrainModifier[]>(
    `/asset-svc/api/v1/terrain-modifiers/?survey_id=${encodeURIComponent(surveyId)}`,
  );
  return res.data ?? [];
}

export async function createTerrainModifier(body: CreateTerrainModifierRequest): Promise<TerrainModifier> {
  const res = await assetSvcClient.post<TerrainModifier, CreateTerrainModifierRequest>(
    "/asset-svc/api/v1/terrain-modifiers/",
    body,
  );
  return res.data;
}

export async function deleteTerrainModifier(id: string): Promise<void> {
  await assetSvcClient.delete(`/asset-svc/api/v1/terrain-modifiers/${encodeURIComponent(id)}`);
}

// --- Design features ---

export async function listDesignFeatures(surveyId: string): Promise<DesignFeature[]> {
  const res = await assetSvcClient.get<DesignFeature[]>(
    `/asset-svc/api/v1/design-features/?survey_id=${encodeURIComponent(surveyId)}`,
  );
  return res.data ?? [];
}

export async function createDesignFeature(body: CreateDesignFeatureRequest): Promise<DesignFeature> {
  const res = await assetSvcClient.post<DesignFeature, CreateDesignFeatureRequest>(
    "/asset-svc/api/v1/design-features/",
    body,
  );
  return res.data;
}

export async function deleteDesignFeature(id: string): Promise<void> {
  await assetSvcClient.delete(`/asset-svc/api/v1/design-features/${encodeURIComponent(id)}`);
}

export function uploadToGCS(
  signedUrl: string,
  file: File,
  onProgress: (loaded: number, total: number) => void,
  headers?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    // GCS signed URLs sign a specific set of headers (notably Content-Type);
    // when the caller provides them, send exactly those. Otherwise fall back to
    // the generic octet-stream default for callers that don't sign headers.
    if (headers && Object.keys(headers).length > 0) {
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    } else {
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`GCS upload failed: ${xhr.status} ${xhr.statusText}`));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
