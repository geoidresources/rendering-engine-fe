import { userSvcClient } from "@/lib/http";
import type { LoginRequest, LoginResponse } from "./type";

export async function loginUser(
  credentials: LoginRequest
): Promise<LoginResponse> {
  const res = await userSvcClient.post<LoginResponse, LoginRequest>(
    "/user-svc/api/v1/user/login",
    credentials
  );
  return res.data;
}
