"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { X, MapPin, BarChart2, Maximize2, Calendar, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/api";
import { useProjectVolume } from "./useProjectVolume";

interface Props {
  project: Project;
  onClose: () => void;
}

function fmtArea(m2: number): string {
  if (!Number.isFinite(m2) || m2 <= 0) return "—";
  const ha = m2 / 10_000;
  return ha >= 1 ? `${ha.toFixed(1)} ha` : `${m2.toFixed(0)} m²`;
}

function fmtVolume(m3: number | null): string {
  if (m3 === null) return "—";
  if (m3 >= 1_000_000) return `${(m3 / 1_000_000).toFixed(2)} Mm³`;
  if (m3 >= 1_000) return `${(m3 / 1_000).toFixed(1)} km³`; // won't happen, but just in case
  return `${m3.toFixed(0)} m³`;
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
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

/**
 * Glassmorphic info card anchored top-right on the globe.
 * The physical position (absolute top-6 right-6) is controlled by the parent.
 * The SVG leader line + pulsing dot are managed separately in GlobeScene.
 *
 * Uses forwardRef so GlobeScene can read the card's bounding rect for the
 * line's endpoint computation.
 */
export const ProjectPlacard = forwardRef<HTMLDivElement, Props>(
  ({ project, onClose }, ref) => {
    const { totalVolume, isLoading: volumeLoading } = useProjectVolume(
      project.id,
    );

    return (
      <motion.div
        ref={ref}
        key={project.id}
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className={cn(
          "w-[272px] overflow-hidden rounded-md",
          "border border-primary/25 bg-[#0b0b14]/85 backdrop-blur-2xl",
          "shadow-[0_8px_48px_rgba(0,0,0,0.7),0_0_0_1px_rgba(245,210,89,0.07)]",
          "pointer-events-auto",
        )}
      >
        {/* Top accent bar */}
        <div className="h-[2px] bg-gradient-to-r from-primary/0 via-primary/70 to-primary/0" />

        {/* Header */}
        <div className="flex items-start gap-2.5 px-4 pt-3.5 pb-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary/12">
            <MapPin className="h-3.5 w-3.5 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            {project.is_active && (
              <div className="mb-1 flex items-center gap-1">
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-emerald-400/80">
                  Active
                </span>
              </div>
            )}
            <div className="text-[13.5px] font-semibold leading-snug text-foreground">
              {project.name}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            aria-label="Close project info"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Description */}
        {project.description && (
          <div className="px-4 pb-3 text-[11.5px] leading-relaxed text-muted-foreground/80 line-clamp-2">
            {project.description}
          </div>
        )}

        {/* Stats — 2×2 grid */}
        <div className="mx-4 h-px bg-border/50" />
        <div className="grid grid-cols-2 gap-px bg-border/30 overflow-hidden mx-0">
          <StatCell
            icon={<BarChart2 className="h-3 w-3" />}
            label="Surveys"
            value={String(project.survey_count ?? 0)}
          />
          <StatCell
            icon={<Maximize2 className="h-3 w-3" />}
            label="Area"
            value={fmtArea(project.total_area_m2)}
          />
          <StatCell
            icon={<Package className="h-3 w-3" />}
            label="Volume"
            value={volumeLoading ? "…" : fmtVolume(totalVolume)}
          />
          <StatCell
            icon={<Calendar className="h-3 w-3" />}
            label="Last Survey"
            value={fmtDate(project.latest_survey_date)}
          />
        </div>

        {/* Bottom accent */}
        <div className="h-[1.5px] bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0" />
      </motion.div>
    );
  },
);
ProjectPlacard.displayName = "ProjectPlacard";

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-[#0b0b14]/60 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <div className="text-[12.5px] font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
