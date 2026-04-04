import { ApiClient } from "./ApiClient";

export const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://saver-generate-usgs-values.trycloudflare.com",
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
