"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, FolderOpen, AlertCircle, Home } from "lucide-react";
import { apiClient, unwrapList } from "@/lib/http";
import { cn } from "@/lib/utils";
import { useViewerStore } from "@/store/viewerStore";
import type { ListEnvelope, Project, Survey } from "@/types/api";
import { FolderItem } from "./FolderItem";
import { useFlyToProject } from "./useFlyToProject";

// Both /projects and /surveys are list endpoints — the backend wraps them
// in `{data, pagination}`. We route through the shared `unwrapList` helper
// so the sidebar renders a plain array and never calls `.map` on an object.

function useProjectsList() {
  return useQuery({
    queryKey: ["sidebar", "projects"],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<Project>>(
        "/api/v1/projects",
      );
      return unwrapList<Project>(res.data);
    },
  });
}

function useSurveysForProject(projectId: string | null) {
  return useQuery({
    queryKey: ["sidebar", "surveys", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<Survey>>(
        `/api/v1/surveys?project_id=${projectId}`,
      );
      return unwrapList<Survey>(res.data);
    },
  });
}

/**
 * Left-side projects browser overlaid on the /project globe.
 *
 * Layout: absolute-positioned panel with backdrop blur. Does not push the globe.
 * Interaction: click a project folder → folder animates open, globe flies to
 * project coords, nested survey folders load below.
 */
export function ProjectsSidebar() {
  const router = useRouter();
  const projects = useProjectsList();
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(
    null,
  );
  const [collapsed, setCollapsed] = useState(false);
  const { flyToProject, flyToSurvey } = useFlyToProject();
  const setFocusedProject = useViewerStore((s) => s.setFocusedProject);

  const handleProjectClick = (project: Project) => {
    const isCollapsing = expandedProjectId === project.id;
    const next = isCollapsing ? null : project.id;
    setExpandedProjectId(next);

    if (isCollapsing) {
      // Collapsing: clear the placard.
      setFocusedProject(null);
    } else {
      // Expanding: set focused project so the placard can appear after flyTo.
      setFocusedProject(project);
      flyToProject(project);
    }
  };

  const handleSurveyClick = async (survey: Survey) => {
    await flyToSurvey(survey);
    router.push(`/project?surveyId=${survey.id}`);
  };

  const projectCount = projects.data?.length ?? 0;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 44 : 288 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className={cn(
        "pointer-events-auto absolute left-4 top-4 bottom-4 z-20 flex flex-col overflow-hidden",
        "rounded-md border border-border/60 bg-card/80 backdrop-blur-md",
        "shadow-[0_8px_32px_rgba(0,0,0,0.45)]",
      )}
      aria-label="Projects"
    >
      {/* Collapsed strip — shown only when sidebar is collapsed */}
      {collapsed && (
        <div className="flex flex-col items-center gap-1 py-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-sm",
              "text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors",
            )}
            aria-label="Go to home"
            title="Home"
          >
            <Home className="h-4 w-4" />
          </button>
          <div className="h-px w-6 bg-border/60" />
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-sm",
              "text-muted-foreground hover:bg-white/5 hover:text-primary transition-colors",
            )}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Expanded header — shown only when sidebar is open */}
      {!collapsed && (
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-sm",
              "text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors",
            )}
            aria-label="Go to home"
            title="Home"
          >
            <Home className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="truncate text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              Projects
            </div>
            <div className="truncate text-[13px] font-semibold text-foreground">
              {projectCount === 0 ? "—" : `${projectCount} total`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-sm",
              "text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors",
            )}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Body — hidden when collapsed */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto overscroll-contain px-2 py-2"
          >
            {projects.isLoading && <SidebarSkeleton />}

            {projects.isError && (
              <div className="flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  Couldn&apos;t load projects.
                  <button
                    type="button"
                    onClick={() => projects.refetch()}
                    className="ml-1 underline underline-offset-2 hover:text-destructive-foreground"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {projects.isSuccess && projects.data.length === 0 && (
              <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                No projects yet.
              </div>
            )}

            {projects.isSuccess &&
              projects.data.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  isExpanded={expandedProjectId === project.id}
                  onClick={() => handleProjectClick(project)}
                  onSurveyClick={handleSurveyClick}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

/* ── Row components ─────────────────────────────────────── */

function ProjectRow({
  project,
  isExpanded,
  onClick,
  onSurveyClick,
}: {
  project: Project;
  isExpanded: boolean;
  onClick: () => void;
  onSurveyClick: (s: Survey) => void;
}) {
  // Only fetch surveys for the expanded project (lazy).
  const surveys = useSurveysForProject(isExpanded ? project.id : null);

  const meta = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      project.survey_count === 1
        ? "1 survey"
        : `${project.survey_count} surveys`,
    );
    return parts.join(" · ");
  }, [project.survey_count]);

  return (
    <FolderItem
      label={project.name}
      meta={meta}
      variant="project"
      isExpanded={isExpanded}
      onClick={onClick}
    >
      {surveys.isLoading && (
        <div className="px-2 py-1 text-[11px] text-muted-foreground">
          Loading surveys…
        </div>
      )}
      {surveys.isError && (
        <div className="px-2 py-1 text-[11px] text-destructive">
          Couldn&apos;t load surveys.
        </div>
      )}
      {surveys.isSuccess && surveys.data.length === 0 && (
        <div className="px-2 py-1 text-[11px] text-muted-foreground">
          No surveys yet.
        </div>
      )}
      {surveys.isSuccess &&
        surveys.data.map((survey) => (
          <FolderItem
            key={survey.id}
            label={formatSurveyDate(survey.survey_date)}
            meta={survey.status}
            variant="survey"
            isExpanded={false}
            onClick={() => onSurveyClick(survey)}
          />
        ))}
    </FolderItem>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-sm px-2 py-2"
        >
          <div className="h-9 w-11 animate-pulse rounded-sm bg-white/5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded-sm bg-white/5" />
            <div className="h-2 w-1/3 animate-pulse rounded-sm bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatSurveyDate(iso: string): string {
  if (!iso) return "Survey";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
