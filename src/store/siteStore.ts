import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "3d" | "map" | "split" | "table";

interface RecentSite {
  projectId: string;
  name: string;
  visitedAt: number;
}

interface SiteState {
  activeProjectId: string | null;
  activeSurveyId: string | null;
  viewMode: ViewMode;
  recentSites: RecentSite[];

  setActiveProject: (projectId: string | null, name?: string) => void;
  setActiveSurvey: (surveyId: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  clearSite: () => void;
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      activeSurveyId: null,
      viewMode: "3d",
      recentSites: [],

      setActiveProject: (projectId, name) =>
        set((state) => {
          if (!projectId) {
            return { activeProjectId: null, activeSurveyId: null };
          }
          const existing = state.recentSites.filter((s) => s.projectId !== projectId);
          const entry: RecentSite = {
            projectId,
            name: name ?? existing.find((s) => s.projectId === projectId)?.name ?? "",
            visitedAt: Date.now(),
          };
          return {
            activeProjectId: projectId,
            activeSurveyId: null,
            recentSites: [entry, ...existing].slice(0, 8),
          };
        }),

      setActiveSurvey: (surveyId) => set({ activeSurveyId: surveyId }),

      setViewMode: (mode) => set({ viewMode: mode }),

      clearSite: () =>
        set({ activeProjectId: null, activeSurveyId: null }),
    }),
    {
      name: "geoid.site",
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        activeSurveyId: state.activeSurveyId,
        viewMode: state.viewMode,
        recentSites: state.recentSites,
      }),
    },
  ),
);
