"use client";

// ConversionProgressPanel — floating overlay that visualises the live
// status of a city-twin conversion run.
//
// Two parts:
//   - Top: per-kind status chips (mesh / dsm / orthophoto / point_cloud /
//     vector) with running/complete/failed indicators.
//   - Below: scrolling event timeline showing the raw stage/message rows
//     in the order they were received.
//
// Hosted by LiveCityViewer (or any admin page) — the parent passes a
// (slug, conversion_id) pair and we manage everything else via the
// useConversionEvents hook (1.5 s polling, auto-stops on terminal stage).

import { useEffect, useRef } from "react";
import { useConversionEvents } from "@/hooks/useCityTwin";
import type { ConversionEvent } from "@/types/city-twin";

interface Props {
  slug: string;
  conversionId: string;
  onClose?: () => void;
}

// Map asset kinds to display labels. "run" is synthesised for run-level
// (kind="") events so the timeline doesn't drop them.
const KIND_LABEL: Record<string, string> = {
  run: "Run",
  mesh: "Mesh",
  dsm: "Terrain (DSM)",
  orthophoto: "Orthophoto",
  point_cloud: "Point Cloud",
  vector: "Vectors",
};

const KIND_ICON: Record<string, string> = {
  run: "◎",
  mesh: "⬡",
  dsm: "⛰",
  orthophoto: "▦",
  point_cloud: "⋮⋮",
  vector: "✚",
};

export function ConversionProgressPanel({ slug, conversionId, onClose }: Props) {
  const { events, byKind, isTerminal, isLoading, isError, error } = useConversionEvents(
    slug,
    conversionId,
  );

  // Scroll the timeline to the bottom whenever a new event arrives so the
  // most recent activity is always in view.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30 w-[380px] rounded-lg border border-white/10 bg-black/80 text-white shadow-xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={isTerminal ? "h-2 w-2 rounded-full bg-emerald-400" : "h-2 w-2 animate-pulse rounded-full bg-amber-400"} />
          <h3 className="text-xs font-semibold tracking-wide uppercase">
            Conversion {isTerminal ? "complete" : "in progress"}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 text-white/60 hover:text-white"
            aria-label="Close progress panel"
          >
            ✕
          </button>
        )}
      </header>

      {/* Per-kind chips */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {(["mesh", "dsm", "orthophoto", "point_cloud", "vector"] as const).map((k) => {
          const row = byKind.find((b) => b.kind === k);
          const status = row?.status ?? "pending";
          return (
            <KindChip
              key={k}
              icon={KIND_ICON[k] ?? "•"}
              label={KIND_LABEL[k] ?? k}
              status={status}
              percentage={row?.percentage}
              message={row?.lastMessage}
            />
          );
        })}
      </div>

      {/* Status banner */}
      {isError && (
        <div className="px-3 py-2 text-xs text-red-300">
          poll error — {error?.message ?? "unknown"}
        </div>
      )}
      {isLoading && events.length === 0 && (
        <div className="px-3 py-2 text-xs text-white/60">awaiting first event…</div>
      )}

      {/* Event timeline */}
      <div
        ref={scrollRef}
        className="max-h-[280px] overflow-y-auto border-t border-white/10 px-3 py-2 font-mono text-[11px] leading-tight"
      >
        {events.length === 0 && !isLoading && (
          <div className="text-white/40">no events yet</div>
        )}
        {events.map((e) => (
          <TimelineRow key={`${e.id}-${e.created_at}-${e.stage}-${e.kind}`} ev={e} />
        ))}
      </div>

      <footer className="border-t border-white/10 px-3 py-1.5 text-[10px] text-white/40">
        {events.length} event{events.length === 1 ? "" : "s"} • {conversionId.slice(0, 8)}…
      </footer>
    </div>
  );
}

// --- Sub-components ---

function KindChip({
  icon,
  label,
  status,
  percentage,
  message,
}: {
  icon: string;
  label: string;
  status: "pending" | "running" | "complete" | "failed";
  percentage?: number;
  message?: string;
}) {
  const colour = {
    pending: "bg-white/5 text-white/40 border-white/10",
    running: "bg-amber-500/10 text-amber-300 border-amber-500/40",
    complete: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
    failed: "bg-red-500/10 text-red-300 border-red-500/40",
  }[status];
  const indicator = {
    pending: "•",
    running: "↻",
    complete: "✓",
    failed: "✗",
  }[status];
  return (
    <div className={`rounded border px-2 py-1.5 ${colour}`} title={message ?? ""}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide">
        <span className="flex items-center gap-1">
          <span className="text-sm">{icon}</span> {label}
        </span>
        <span className={status === "running" ? "animate-spin-slow" : ""}>{indicator}</span>
      </div>
      {percentage != null && status === "running" && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-amber-300/80 transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function TimelineRow({ ev }: { ev: ConversionEvent }) {
  const colour = {
    started: "text-amber-300",
    progress: "text-sky-300",
    complete: "text-emerald-300",
    failed: "text-red-300",
  }[ev.status as "started" | "progress" | "complete" | "failed"] ?? "text-white/70";

  const time = (ev.created_at || "").slice(11, 19); // HH:MM:SS
  const kind = ev.kind || "run";
  return (
    <div className="flex gap-2 py-0.5">
      <span className="shrink-0 text-white/40">{time}</span>
      <span className={`shrink-0 w-3 ${colour}`}>
        {ev.status === "complete" ? "✓" : ev.status === "failed" ? "✗" : ev.status === "started" ? "▶" : "·"}
      </span>
      <span className="shrink-0 w-24 truncate text-white/60">{kind}/{ev.stage}</span>
      <span className="flex-1 truncate text-white/80">{ev.message ?? ""}</span>
      {ev.percentage != null && (
        <span className="shrink-0 text-white/50">{ev.percentage.toFixed(0)}%</span>
      )}
    </div>
  );
}
