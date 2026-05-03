import { ApiClient } from "./ApiClient";

// rendering-engine-be — read-only data layer (:8080)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!API_BASE_URL) {
  console.warn("NEXT_PUBLIC_API_BASE_URL is missing. API calls to rendering-engine-be will fail.");
}
export const apiClient = new ApiClient({
  baseURL: API_BASE_URL ?? "",
  timeout: 30_000,
});

// user-svc — auth, user management, project CRUD (:8081)
const USER_SVC_URL = process.env.NEXT_PUBLIC_USER_SVC_URL;
if (!USER_SVC_URL) {
  console.warn("NEXT_PUBLIC_USER_SVC_URL is missing. API calls to user-svc will fail.");
}
export const userSvcClient = new ApiClient({
  baseURL: USER_SVC_URL ?? "",
  timeout: 15_000,
});

// asset-svc — survey/asset CRUD, analytics triggers (:8082)
const ASSET_SVC_URL = process.env.NEXT_PUBLIC_ASSET_SVC_URL;
if (!ASSET_SVC_URL) {
  console.warn("NEXT_PUBLIC_ASSET_SVC_URL is missing. API calls to asset-svc will fail.");
}
export const assetSvcClient = new ApiClient({
  baseURL: ASSET_SVC_URL ?? "",
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
