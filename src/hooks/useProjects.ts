import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http";
import type { Project } from "@/types/api";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await apiClient.get<Project[]>("/api/v1/projects");
      return res.data;
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
