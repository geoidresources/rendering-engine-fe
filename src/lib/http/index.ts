import { ApiClient } from "./ApiClient";

// rendering-engine-be — read-only data layer (:8080)
export const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  timeout: 30_000,
});

// user-svc — auth, user management, project CRUD (:8081)
export const userSvcClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_USER_SVC_URL ?? "http://localhost:8081",
  timeout: 15_000,
});

// asset-svc — survey/asset CRUD, analytics triggers (:8082)
export const assetSvcClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_ASSET_SVC_URL ?? "http://localhost:8082",
  timeout: 30_000,
});

export { ApiClient } from "./ApiClient";
export type { ApiClientConfig, ApiResponse, ApiError } from "./ApiClient";
export {
  addParamToUrl,
  addParamsToUrl,
  removeParamFromUrl,
  getParamsFromUrl,
} from "./urlUtils";
export { unwrapList } from "./unwrap";
