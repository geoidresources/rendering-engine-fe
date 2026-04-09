import { assetSvcClient } from "@/lib/http";
import type {
  GetSignedUrlRequest,
  GetSignedUrlResponse,
  CreateAssetRequest,
  CreateAssetResponse,
  CreateSurveyRequest,
  AssetSvcSurveyResponse,
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

export function uploadToGCS(
  signedUrl: string,
  file: File,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

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
