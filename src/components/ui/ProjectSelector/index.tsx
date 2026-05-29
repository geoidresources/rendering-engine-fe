"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { userSvcClient } from "@/lib/http";
import { useProjectStore, type ProjectRecord } from "@/store/projectStore";
import { usePermissionStore } from "@/store/permissionStore";
import { useSiteStore } from "@/store/siteStore";

/**
 * ProjectSelector — renders a dropdown backed by user-svc
 * (GET /user-svc/api/v1/project). On selection it:
 *   1. Updates projectStore.activeProjectId (persisted to localStorage)
 *   2. Primes the permission cache for the selected project
 *   3. Syncs with siteStore so ContextBar / Viewer layers reflect the choice
 *
 * Mounted inside ContextBar's left-hand nav cluster.
 */
export function ProjectSelector() {
  const setProjects = useProjectStore((s) => s.setProjects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const fetchPermissions = usePermissionStore((s) => s.fetchPermissions);
  const setSiteActiveProject = useSiteStore((s) => s.setActiveProject);

  const { data: projects = [], isLoading } = useQuery<ProjectRecord[]>({
    queryKey: ["user-svc-projects"],
    queryFn: async () => {
      const res = await userSvcClient.get<ProjectRecord[]>(
        "/user-svc/api/v1/project"
      );
      return res.data;
    },
    staleTime: 60_000,
  });

  // Populate the store whenever the query resolves.
  useEffect(() => {
    if (projects.length > 0) {
      setProjects(projects);
    }
  }, [projects, setProjects]);

  // Auto-select the first project if nothing is persisted.
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      const first = projects[0];
      setActiveProject(first.id);
      setSiteActiveProject(first.id, first.name);
      fetchPermissions(first.id);
    }
  }, [activeProjectId, projects, setActiveProject, setSiteActiveProject, fetchPermissions]);

  const handleValueChange = (id: string | null) => {
    if (!id) return;
    const project = projects.find((p) => p.id === id);
    setActiveProject(id);
    setSiteActiveProject(id, project?.name);
    fetchPermissions(id);
  };

  return (
    <div className="flex items-center gap-1.5">
      <MapPin className="size-3.5 text-text-muted" />
      <Select
        value={activeProjectId ?? ""}
        onValueChange={handleValueChange}
        disabled={isLoading}
      >
        <SelectTrigger
          size="sm"
          className="border-transparent bg-transparent hover:bg-bg-elevated min-w-[180px]"
        >
          <SelectValue placeholder="Select site">
            {() => {
              if (isLoading) return "Loading…";
              const active = projects.find((p) => p.id === activeProjectId);
              return active?.name ?? "Select site";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Sites</SelectLabel>
            {projects.length === 0 && (
              <SelectItem value="__none" disabled>
                No sites available
              </SelectItem>
            )}
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
