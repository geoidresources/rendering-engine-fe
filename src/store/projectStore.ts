import { create } from "zustand";
import { persist } from "zustand/middleware";

const ACTIVE_PROJECT_KEY = "active_project_id";

export interface ProjectRecord {
  id: string;
  client_id: string;
  name: string;
  description: string;
  settings: Record<string, unknown>;
  is_active: boolean;
  lifecycle_status: "active" | "suspended" | "review" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

interface ProjectStore {
  activeProjectId: string | null;
  projects: ProjectRecord[];

  setActiveProject(id: string | null): void;
  setProjects(projects: ProjectRecord[]): void;
  reset(): void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      activeProjectId: null,
      projects: [],

      setActiveProject(id) {
        set({ activeProjectId: id });
      },

      setProjects(projects) {
        set({ projects });
      },

      reset() {
        set({ activeProjectId: null, projects: [] });
      },
    }),
    {
      name: ACTIVE_PROJECT_KEY,
      partialize: (state) => ({ activeProjectId: state.activeProjectId }),
    }
  )
);

/** Ergonomic hook for the active project object + switch helper. */
export function useActiveProject() {
  const id = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.id === id) ?? null;
  return {
    project,
    projects,
    switchProject: useProjectStore.getState().setActiveProject,
  };
}
