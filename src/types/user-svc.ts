// TypeScript types matching user-svc Go DTOs

export type ProjectRole =
  | "project_manager"
  | "survey_manager"
  | "gis_analyst"
  | "mining_engineer"
  | "reviewer"
  | "client_admin"
  | "client_viewer"
  | "api_user";

export const PROJECT_ROLES: ProjectRole[] = [
  "project_manager",
  "survey_manager",
  "gis_analyst",
  "mining_engineer",
  "reviewer",
  "client_admin",
  "client_viewer",
  "api_user",
];

export interface ProjectMember {
  user_id: string;
  email: string;
  name: string;
  roles: ProjectRole[];
  assigned_at: string;
}

export interface AddMemberRequest {
  user_id: string;
  role: ProjectRole;
}
