import { userSvcClient } from "@/lib/http";
import type { ProjectMember, AddMemberRequest, ProjectRole } from "@/types/user-svc";

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const res = await userSvcClient.get<ProjectMember[]>(
    `/user-svc/api/v1/projects/${encodeURIComponent(projectId)}/members`,
  );
  return res.data ?? [];
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<void> {
  const body: AddMemberRequest = { user_id: userId, role };
  await userSvcClient.post(
    `/user-svc/api/v1/projects/${encodeURIComponent(projectId)}/members`,
    body,
  );
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await userSvcClient.delete(
    `/user-svc/api/v1/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
  );
}

// User lookup by email — user-svc endpoint may return an array or envelope.
// Returns the first matching user or null.
export async function lookupUserByEmail(email: string): Promise<{ id: string; name: string; email: string } | null> {
  try {
    const res = await userSvcClient.get<{ id: string; name: string; email: string }[]>(
      `/user-svc/api/v1/users`,
      { params: { email } },
    );
    const rows = Array.isArray(res.data) ? res.data : (res.data as { data?: { id: string; name: string; email: string }[] })?.data ?? [];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
