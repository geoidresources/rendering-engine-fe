
// --- Login Request / Response Types -------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ClientAccountDetails {
  bank_account_number: string;
  bank_name: string;
  order_api_url: string;
}

export interface CreatedBy {
  email: string;
  id: string;
}

export interface Client {
  _id: string;
  account_details: ClientAccountDetails;
  company_name: string;
  company_role: string;
  country_code: string;
  created_at: number;
  created_by: CreatedBy;
  domain: string;
  edited_by: CreatedBy;
  email: string;
  internal_access: boolean;
  is_active: boolean;
  last_login_time: number;
  name: string;
  phone_number: string;
  referral_code: string;
  subscribe_plan: boolean;
  subscription_id: string;
  updated_at: number;
}

export interface User {
  avatar_url: string;
  client_id: string;
  email: string;
  id: string;
  last_login_time: number;
  name: string;
  role: string;
}

export interface LoginResponse {
  client: Client;
  client_id: string;
  email: string;
  expire_at: number;
  id: string;
  is_onboarded: boolean;
  password: boolean;
  proxy_access: boolean;
  token: string;
  unpublished_access: boolean;
  user: User;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
  general?: string;
}
