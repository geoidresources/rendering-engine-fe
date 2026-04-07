import type { LoginRequest, LoginResponse } from "./type";

export async function loginUser(
  credentials: LoginRequest
): Promise<LoginResponse> {
  const now = Date.now();
  const safeName = credentials.email.split("@")[0] || "User";

  return {
    token: "dev-auth-token",
    id: "dev-user-id",
    email: credentials.email,
    client_id: "dev-client-id",
    expire_at: now + 24 * 60 * 60 * 1000,
    is_onboarded: true,
    password: true,
    proxy_access: false,
    unpublished_access: false,
    user: {
      id: "dev-user-id",
      email: credentials.email,
      name: safeName,
      role: "admin",
      client_id: "dev-client-id",
      avatar_url: "",
      last_login_time: now,
    },
    client: {
      _id: "dev-client-id",
      account_details: {
        bank_account_number: "",
        bank_name: "",
        order_api_url: "",
      },
      company_name: "Development Client",
      company_role: "client",
      country_code: "US",
      created_at: now,
      created_by: {
        email: credentials.email,
        id: "dev-user-id",
      },
      domain: "localhost",
      edited_by: {
        email: credentials.email,
        id: "dev-user-id",
      },
      email: credentials.email,
      internal_access: true,
      is_active: true,
      last_login_time: now,
      name: "Dev Workspace",
      phone_number: "",
      referral_code: "",
      subscribe_plan: false,
      subscription_id: "",
      updated_at: now,
    },
  };
}
