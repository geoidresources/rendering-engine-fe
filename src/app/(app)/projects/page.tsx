"use client";

import { useState } from "react";
import ProjectCard from "@/components/ui/ProjectCard";
import AppButton from "@/components/ui/AppButton";
import { LayoutGrid, List } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";

const SECTOR_OPTIONS = ["All Sectors", "Mine Site", "Quarry", "Construction", "Landfill", "Infrastructure"];

export default function ProjectsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sectorFilter, setSectorFilter] = useState("All Sectors");
  const { data: projects, isLoading } = useProjects();

  const filteredProjects = (projects ?? []).filter((p) => {
    if (sectorFilter === "All Sectors") return true;
    const sector = p.description || "Mine Site";
    return sector.toLowerCase().includes(sectorFilter.toLowerCase());
  });

  const cards = filteredProjects.map((p) => {
    const coords = p.settings?.coordinates as Record<string, number> | undefined;
    const lat = coords?.lat ?? coords?.latitude;
    const lng = coords?.lng ?? coords?.longitude;
    return {
    name: p.name,
    sector: p.description || "Mine Site",
    coordinates: lat != null && lng != null ? { lat, lng } : undefined,
    tags: [p.settings?.crs ?? "WGS84", `${p.survey_count} survey${p.survey_count !== 1 ? "s" : ""}`],
    metrics: [
      { label: "Total Area", value: p.total_area_m2 >= 1000 ? `${(p.total_area_m2 / 1000).toFixed(1)} KM²` : `${p.total_area_m2.toFixed(0)} M²` },
      { label: "Surveys", value: String(p.survey_count) },
    ],
    status: "active" as const,
    href: `/projects/${p.id}`,
  };
  });

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* View toggle */}
          <div className="flex border border-border-subtle rounded-sm overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={`flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider font-medium transition-colors cursor-pointer border-none ${
                view === "grid"
                  ? "bg-bg-elevated text-text-primary"
                  : "bg-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              <LayoutGrid size={14} /> Grid
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider font-medium transition-colors cursor-pointer border-none ${
                view === "list"
                  ? "bg-bg-elevated text-text-primary"
                  : "bg-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              <List size={14} /> List
            </button>
          </div>

          {/* Sector filter */}
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-bg-elevated border border-border-subtle rounded-sm px-3 py-2 text-[10px] uppercase tracking-wider font-medium text-text-secondary cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {SECTOR_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>

          <span className="text-text-muted text-[10px] uppercase tracking-wider font-mono">
            Total Entities: {isLoading ? "..." : cards.length}
          </span>
        </div>

        <AppButton variant="primary" size="sm">
          Initialize New Site
        </AppButton>
      </div>

      {/* Project Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-text-muted text-xs">
          Loading projects...
        </div>
      ) : cards.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-text-muted text-xs">
          No projects found. Create your first site to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((project) => (
            <ProjectCard key={project.name} {...project} />
          ))}
        </div>
      )}
    </div>
  );
}
