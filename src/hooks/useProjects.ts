// `/api/v1/projects` is a list endpoint, so rendering-engine-be wraps the
// response in the `{data, pagination}` envelope per the response-shape ADR
// (`internal/handlers/handlers.go` → `listEnvelope`). We unwrap via the
// shared helper so every caller gets a plain `Project[]` regardless of
// whether the server regresses to a raw array on a future release.
// `/api/v1/projects/:id` is an object endpoint — it stays raw.

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapList } from "@/lib/http";
import type { ListEnvelope, Project } from "@/types/api";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<Project>>(
        "/api/v1/projects",
      );
      return unwrapList<Project>(res.data);
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      const res = await apiClient.get<Project>(`/api/v1/projects/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}
