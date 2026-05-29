// cityTwinApi.ts — typed wrappers for the city digital twin endpoints on
// asset-svc (writes) and rendering-engine-be (reads + tile proxy).
//
// All writes go through asset-svc:8082 because the citytwin_handler lives
// there. Reads (twin metadata + active conversion URLs) can come from either
// service — we use asset-svc for symmetry with writes so the UI doesn't need
// to think about which client to use.

import { apiClient, assetSvcClient } from "@/lib/http";
import type {
  CityTwin,
  CityTwinAsset,
  CityTwinConversion,
  ConversionEvent,
  CreateTwinRequest,
  InitAssetUploadRequest,
  InitAssetUploadResponse,
  MarkAssetUploadedRequest,
  TriggerConversionResponse,
} from "@/types/city-twin";

const BASE_WRITE = "/asset-svc/api/v1/city-twins"; // asset-svc — writes
const BASE_READ = "/api/v1/city-twins"; // rendering-engine-be — reads + proxied tile URLs

// --- Twin reads ---
//
// Reads go through rendering-engine-be because its twinPublicShape rewrites
// raw gs:// URLs into proxied paths like /api/v1/city-twins/:slug/mesh/...
// so Cesium can fetch tile bytes through our tenant-aware proxy. Writes
// (POST /city-twins, /convert, etc.) still hit asset-svc directly.

export async function listCityTwins(): Promise<CityTwin[]> {
  const res = await apiClient.get<CityTwin[]>(BASE_READ);
  return res.data ?? [];
}

export async function getCityTwin(slug: string): Promise<CityTwin> {
  const res = await apiClient.get<CityTwin>(`${BASE_READ}/${encodeURIComponent(slug)}`);
  return res.data;
}

export async function createCityTwin(body: CreateTwinRequest): Promise<CityTwin> {
  const res = await assetSvcClient.post<CityTwin, CreateTwinRequest>(BASE_WRITE, body);
  return res.data;
}

// --- Asset attach ---

export async function listCityTwinAssets(slug: string): Promise<CityTwinAsset[]> {
  const res = await assetSvcClient.get<CityTwinAsset[]>(
    `${BASE_WRITE}/${encodeURIComponent(slug)}/assets`,
  );
  return res.data ?? [];
}

// --- Asset upload (Phase 2) ---
//
// Three-step ladder per asset:
//   1. POST  /assets/init       — reserve an asset row, get N signed PUT URLs
//   2. PUT   <signed_url>       — fan out file bytes directly to GCS
//   3. PATCH /assets/:id        — mark uploaded; processor becomes eligible
// The DELETE archives an uploaded asset so the operator can replace it.

export async function initCityTwinAssetUpload(
  slug: string,
  req: InitAssetUploadRequest,
): Promise<InitAssetUploadResponse> {
  const res = await assetSvcClient.post<InitAssetUploadResponse, InitAssetUploadRequest>(
    `${BASE_WRITE}/${encodeURIComponent(slug)}/assets/init`,
    req,
  );
  return res.data;
}

export async function markCityTwinAssetUploaded(
  slug: string,
  assetId: string,
  req: MarkAssetUploadedRequest,
): Promise<CityTwinAsset> {
  const res = await assetSvcClient.patch<CityTwinAsset, MarkAssetUploadedRequest>(
    `${BASE_WRITE}/${encodeURIComponent(slug)}/assets/${encodeURIComponent(assetId)}`,
    req,
  );
  return res.data;
}

export async function archiveCityTwinAsset(slug: string, assetId: string): Promise<void> {
  await assetSvcClient.delete<void>(
    `${BASE_WRITE}/${encodeURIComponent(slug)}/assets/${encodeURIComponent(assetId)}`,
  );
}

// --- Conversions ---

export async function triggerConversion(slug: string): Promise<TriggerConversionResponse> {
  const res = await assetSvcClient.post<TriggerConversionResponse>(
    `${BASE_WRITE}/${encodeURIComponent(slug)}/convert`,
  );
  return res.data;
}

export async function listConversions(slug: string): Promise<CityTwinConversion[]> {
  const res = await assetSvcClient.get<CityTwinConversion[]>(
    `${BASE_WRITE}/${encodeURIComponent(slug)}/conversions`,
  );
  return res.data ?? [];
}

export async function getConversion(
  slug: string,
  conversionId: string,
): Promise<CityTwinConversion> {
  const res = await assetSvcClient.get<CityTwinConversion>(
    `${BASE_WRITE}/${encodeURIComponent(slug)}/conversions/${conversionId}`,
  );
  return res.data;
}

// --- Live progress events ---

/**
 * Fetch the persisted events for a conversion. `sinceId` lets the caller
 * incrementally tail (the server returns rows with id > sinceId, capped by
 * `limit`, default 200, max 1000).
 */
export async function listConversionEvents(
  slug: string,
  conversionId: string,
  sinceId = 0,
  limit = 200,
): Promise<ConversionEvent[]> {
  const res = await assetSvcClient.get<ConversionEvent[]>(
    `${BASE_WRITE}/${encodeURIComponent(slug)}/conversions/${conversionId}/events`,
    { params: { since_id: sinceId, limit } },
  );
  return res.data ?? [];
}

/**
 * Returns the URL for the SSE stream of a conversion's events.
 * Note: EventSource cannot send Authorization headers; for class-1 routes
 * we use `?token=` query-string auth via the polling endpoint instead
 * (`useConversionEvents` hook).
 */
export function conversionEventsStreamUrl(slug: string, conversionId: string, sinceId = 0): string {
  const base = (process.env.NEXT_PUBLIC_ASSET_SVC_URL ?? "").replace(/\/$/, "");
  return `${base}${BASE_WRITE}/${encodeURIComponent(slug)}/conversions/${conversionId}/events/stream?since_id=${sinceId}`;
}
