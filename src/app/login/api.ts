import { apiClient } from "@/lib/http";
import type { LoginRequest, LoginResponse } from "./type";

const AUTH_SERVICE_BASE = "/user-svc/api/v1/user";

export async function loginUser(
  credentials: LoginRequest
): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>(
    `${AUTH_SERVICE_BASE}/login`,
    credentials
  );
  return data;
}

