import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { AUTH_TOKEN_KEY } from "../constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  message: string;
  status: number;
  data?: unknown;
}

// ─── Base API Client ───────────────────────────────────────────────────────────

export class ApiClient {
  protected readonly instance: AxiosInstance;

  constructor(config: ApiClientConfig) {
    this.instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30_000,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...config.headers,
      },
    });

    this.attachRequestInterceptor();
    this.attachResponseInterceptor();
  }

  // ── Interceptors ────────────────────────────────────────────────────────────

  private attachRequestInterceptor(): void {
    this.instance.interceptors.request.use(
      (cfg: InternalAxiosRequestConfig) => {
        // Attach auth token if present
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem(AUTH_TOKEN_KEY)
            : null;

        if (token && cfg.headers) {
          cfg.headers.Authorization = `Bearer ${token}`;
        }

        return cfg;
      },
      (error) => Promise.reject(this.normaliseError(error))
    );
  }

  private attachResponseInterceptor(): void {
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          // Clear token on 401 Unauthorized
          if (typeof window !== "undefined") {
            localStorage.removeItem(AUTH_TOKEN_KEY);

            // Global store resets — restore all stateompaitial values
            // to avoid leaking data between sessions / users.
            try {
              const { useSiteStore } = require("../../store/siteStore");
              const { useUploadStore } = require("../../store/uploadStore");
              const { useCompareStore } = require("../../store/compareStore");
              const { useViewerStore } = require("../../store/viewerStore");

              useSiteStore.getState().reset();
              useUploadStore.getState().reset();
              useCompareStore.getState().reset();
              useViewerStore.getState().reset();
            } catch (e) {
              console.error("[ApiClient] Store reset failed:", e);
            }

            // Optionally redirect to login if not already there
            if (!window.location.pathname.startsWith("/login")) {
              window.location.href = "/login";
            }
          }
        }
        return Promise.reject(this.normaliseError(error));
      }
    );
  }

  // ── Error normalisation ─────────────────────────────────────────────────────

  private normaliseError(error: unknown): ApiError {
    if (axios.isAxiosError(error)) {
      return {
        message:
          error.response?.data?.message ?? error.message ?? "Unknown error",
        status: error.response?.status ?? 0,
        data: error.response?.data,
      };
    }
    return { message: String(error), status: 0 };
  }

  // ── HTTP Methods ────────────────────────────────────────────────────────────

  async get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const res = await this.instance.get<T>(url, config);
    return { data: res.data, status: res.status };
  }

  async post<T = unknown, D = unknown>(
    url: string,
    body?: D,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const res = await this.instance.post<T>(url, body, config);
    return { data: res.data, status: res.status };
  }

  async put<T = unknown, D = unknown>(
    url: string,
    body?: D,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const res = await this.instance.put<T>(url, body, config);
    return { data: res.data, status: res.status };
  }

  async patch<T = unknown, D = unknown>(
    url: string,
    body?: D,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const res = await this.instance.patch<T>(url, body, config);
    return { data: res.data, status: res.status };
  }

  async delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const res = await this.instance.delete<T>(url, config);
    return { data: res.data, status: res.status };
  }
}
