import { ApiClient } from "./ApiClient";

export const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://192.168.1.13:8081",
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
