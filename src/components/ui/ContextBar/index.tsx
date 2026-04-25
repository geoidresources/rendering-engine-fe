"use client";

import { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Search, MapPin, Calendar, Layers3, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import StatusChip from "@/components/ui/StatusChip";
import { WorkspacePresetPicker } from "@/components/viewer/WorkspacePresetPicker";
import { useSiteStore, type ViewMode } from "@/store/siteStore";
import { useCompareStore } from "@/store/compareStore";
import { useProjects } from "@/hooks/useProjects";
import { useSurveys } from "@/hooks/useSurveys";
import { AUTH_TOKEN_KEY, AUTH_SESSION_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

function formatDateShort(iso: string): string {
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

interface ContextBarProps {
  onCommand?: () => void;
}

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "3d", label: "3D", icon: Layers3 },
  { id: "map", label: "Map", icon: MapPin },
  { id: "split", label: "Split", icon: Columns2 },
];

/**
 * Site-context header for the (app) shell. Replaces the breadcrumb-only
 * TelemetryHeader with the four controls every page in Spatial Studio
 * shares: active site, active epoch, compare toggle, view mode. Search
 * and account controls collapse into the right-hand side. Pages that
 * don't depend on site/epoch just ignore the store reads — the bar
 * degrades gracefully when nothing is selected.
 */
export default function ContextBar({ onCommand }: ContextBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isViewerRoute = pathname?.startsWith("/project") ?? false;
  const isOverview = pathname === "/home";
  const { data: projects = [] } = useProjects();

  const activeProjectId = useSiteStore((s) => s.activeProjectId);
  const activeSurveyId = useSiteStore((s) => s.activeSurveyId);
  const viewMode = useSiteStore((s) => s.viewMode);
  const recentSites = useSiteStore((s) => s.recentSites);
  const setActiveProject = useSiteStore((s) => s.setActiveProject);
  const setActiveSurvey = useSiteStore((s) => s.setActiveSurvey);
  const setViewMode = useSiteStore((s) => s.setViewMode);

  const compareEnabled = useCompareStore((s) => s.enabled);
  const toggleCompare = useCompareStore((s) => s.toggle);

  const { data: surveys = [] } = useSurveys(activeProjectId ?? undefined);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const activeSurvey = useMemo(
    () => surveys.find((s) => s.id === activeSurveyId) ?? null,
    [surveys, activeSurveyId],
  );

  // Fallback label so the trigger never renders a raw UUID while queries resolve.
  const projectLabel =
    activeProject?.name ??
    recentSites.find((s) => s.projectId === activeProjectId)?.name ??
    (activeProjectId ? "Loading…" : undefined);

  const epochLabel = activeSurvey
    ? formatDateShort(activeSurvey.survey_date)
    : activeSurveyId
      ? "Loading…"
      : undefined;

  const handleSignOut = () => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      /* storage disabled */
    }
    router.push("/login");
  };

  return (
    <TooltipProvider delay={120}>
      <header
        role="banner"
        className="h-12 shrink-0 flex items-center gap-2 pl-4 pr-3 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg-surface/60"
      >
        {/* Nav selectors — overview-only */}
        {isOverview && (
          <>
            {/* Site selector */}
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-text-muted" />
              <Select
                value={activeProjectId ?? ""}
                onValueChange={(v) => {
                  if (!v) return;
                  const next = projects.find((p) => p.id === v);
                  setActiveProject(v, next?.name);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="border-transparent bg-transparent hover:bg-bg-elevated min-w-[180px]"
                >
                  <SelectValue placeholder="Select site">
                    {() => projectLabel ?? "Select site"}
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

            {/* Epoch selector */}
            {activeProjectId && (
              <>
                <span className="text-text-muted text-xs">/</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-text-muted" />
                  <Select
                    value={activeSurveyId ?? ""}
                    onValueChange={(v) => setActiveSurvey(v === "__latest" || !v ? null : v)}
                  >
                    <SelectTrigger
                      size="sm"
                      className="border-transparent bg-transparent hover:bg-bg-elevated min-w-[140px]"
                    >
                      <SelectValue placeholder="Latest epoch">
                        {() => epochLabel ?? "Latest epoch"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Epoch</SelectLabel>
                        <SelectItem value="__latest">Latest</SelectItem>
                        {surveys.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {formatDateShort(s.survey_date)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Active survey status */}
            {activeSurvey && (
              <StatusChip
                tone={
                  activeSurvey.status === "complete"
                    ? "success"
                    : activeSurvey.status === "processing"
                      ? "processing"
                      : activeSurvey.status === "failed"
                        ? "danger"
                        : "neutral"
                }
              >
                {activeSurvey.status}
              </StatusChip>
            )}
          </>
        )}

        {/* Workspace preset picker — viewer-only (V-TASK-01) */}
        {isViewerRoute && (
          <>
            <span className="text-text-muted text-xs">/</span>
            <WorkspacePresetPicker />
          </>
        )}

        <div className="flex-1" />



        {/* View mode switcher */}
        <div
          role="tablist"
          aria-label="View mode"
          className="flex items-center gap-0.5 p-0.5 rounded-md bg-bg-elevated border border-border-subtle"
        >
          {VIEW_MODES.map(({ id, label, icon: Icon }) => {
            const active = viewMode === id;
            return (
              <Tooltip key={id}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setViewMode(id)}
                      className={cn(
                        "h-6 px-2 inline-flex items-center gap-1 rounded-sm text-[10px] uppercase tracking-wider font-medium transition-colors",
                        active
                          ? "bg-bg-surface text-text-primary shadow-sm"
                          : "text-text-muted hover:text-text-primary",
                      )}
                    >
                      <Icon className="size-3" />
                      {label}
                    </button>
                  }
                />
                <TooltipContent side="bottom">{label} view</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="w-px h-5 bg-border-subtle mx-1" />

        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Notifications"
                className="text-text-muted hover:text-text-primary"
              >
                <Bell />
              </Button>
            }
          />
          <TooltipContent side="bottom">Alerts</TooltipContent>
        </Tooltip>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account menu"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Avatar className="size-7 border border-border-subtle">
                  <AvatarFallback className="bg-bg-elevated text-text-primary text-[10px] font-mono uppercase">
                    {activeProject?.name?.[0] ?? "G"}
                  </AvatarFallback>
                </Avatar>
              </button>
            }
          />
          <DropdownMenuContent align="end" className="bg-card border-border-subtle w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Account
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border-subtle" />
            <DropdownMenuItem
              className="text-xs uppercase tracking-wider"
              onClick={() => router.push("/client-portal")}
            >
              Team & Access
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs uppercase tracking-wider"
              onClick={() => router.push("/admin")}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border-subtle" />
            <DropdownMenuItem
              className="text-xs uppercase tracking-wider text-destructive"
              onClick={handleSignOut}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </TooltipProvider>
  );
}
