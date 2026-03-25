"use client";

import PageShell from "@/components/ui/PageShell";
import { Chip } from "@heroui/react";

const ANALYST_TILES = [
  { label: "Active Projects", value: "24", color: "bg-blue-600/10 border-blue-600/20 text-blue-400" },
  { label: "Surveys Pending QA", value: "7", color: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
  { label: "Reports This Cycle", value: "12", color: "bg-emerald-600/10 border-emerald-600/20 text-emerald-400" },
  { label: "Monthly Volume (m³)", value: "1.4M", color: "bg-violet-600/10 border-violet-600/20 text-violet-400" },
  { label: "Active Alerts", value: "3", color: "bg-red-600/10 border-red-600/20 text-red-400" },
];

const ALERTS = [
  { label: "Pending QA", count: 5, color: "warning" as const },
  { label: "Ready to Approve", count: 2, color: "success" as const },
  { label: "Upload Errors", count: 1, color: "danger" as const },
];

export default function HomePage() {
  return (
    <PageShell
      title="Dashboard"
      description="GEOID Analyst overview — your project portfolio at a glance."
    >
      {/* Alerts bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-zinc-500 text-xs">Quick alerts:</span>
        {ALERTS.map((a) => (
          <Chip key={a.label} color={a.color} size="sm" variant="primary" className="text-xs">
            {a.count} · {a.label}
          </Chip>
        ))}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ANALYST_TILES.map((t) => (
          <div
            key={t.label}
            className={`rounded-xl border p-4 flex flex-col gap-1 ${t.color}`}
          >
            <span className="text-2xl font-bold">{t.value}</span>
            <span className="text-xs text-zinc-400">{t.label}</span>
          </div>
        ))}
      </div>

      {/* Placeholder below */}
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          Project activity feed and recent survey updates will appear here.
        </p>
      </div>
    </PageShell>
  );
}
