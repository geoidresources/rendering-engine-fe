"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import MetricStatBlock from "@/components/ui/MetricStatBlock";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import AppButton from "@/components/ui/AppButton";
import MiniBarChart from "@/components/ui/MiniBarChart";
import CircularProgress from "@/components/ui/CircularProgress";
import { useDashboardSummary } from "@/hooks/useDashboard";

/* ── Helpers ────────────────────────────────────────────── */

const TIME_RANGES = ["Day", "Week", "Month", "Year"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const STATUS_VARIANT: Record<string, "active" | "offline" | "standby" | "tag"> = {
  complete: "active",
  processing: "standby",
  queued: "tag",
  failed: "offline",
};

const currentMonthIndex = new Date().getMonth();

function formatDate(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" });
  const year = now.getFullYear();
  return `1 ${month} – ${now.getDate()} ${month} ${year}`;
}

/* ── Column config for DataTable ────────────────────────── */

const pipelineColumns = [
  { key: "project", label: "Project", mono: true as const, sortable: true },
  {
    key: "epoch",
    label: "Epoch",
    mono: true as const,
    sortable: true,
    render: (val: unknown) => {
      if (!val || val === "") return <span className="text-text-muted">—</span>;
      const d = new Date(val as string);
      return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
    },
  },
  {
    key: "stage",
    label: "Stage",
    render: (val: unknown) => <StatusBadge variant="tag">{val as string}</StatusBadge>,
  },
  { key: "duration", label: "Duration", mono: true as const, align: "right" as const },
  {
    key: "status",
    label: "Status",
    render: (val: unknown) => {
      const s = val as string;
      return <StatusBadge variant={STATUS_VARIANT[s] ?? "tag"}>{s}</StatusBadge>;
    },
  },
];

/* ── Page ───────────────────────────────────────────────── */

export default function HomePage() {
  const { data, isLoading } = useDashboardSummary();
  const [range, setRange] = useState<TimeRange>("Month");

  const stats = [
    {
      title: "Active Projects",
      value: data ? String(data.active_projects).padStart(2, "0") : "--",
    },
    {
      title: "Surveys This Month",
      value: data ? String(data.total_surveys).padStart(2, "0") : "--",
    },
    {
      title: "Processing Queue",
      value: data ? String(data.pending_surveys).padStart(2, "0") : "--",
    },
    {
      title: "Open Alerts",
      value: data ? String(data.alert_count).padStart(2, "0") : "--",
    },
  ];

  const pipelineActivity = data?.pipeline_activity ?? [];
  const pipelineRows = (data?.pipeline_rows ?? []) as unknown as Record<string, unknown>[];
  const pipelineHealth = data?.pipeline_health_pct ?? 0;
  const pipelineCounts = data?.pipeline_counts ?? { complete: 0, processing: 0, failed: 0 };

  // Align bar chart active index to current month within the 12-slot window.
  const activeBarIndex = pipelineActivity.length > 0 ? pipelineActivity.length - 1 : currentMonthIndex;

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-text-primary text-2xl font-bold uppercase tracking-wider">
          Dashboard
        </h1>

        <div className="flex items-center gap-4">
          {/* Pill toggle */}
          <div className="bg-bg-elevated rounded-sm p-0.5 flex">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`
                  px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium rounded-sm
                  transition-colors duration-200 cursor-pointer border-none
                  ${r === range
                    ? "bg-primary text-bg-base"
                    : "bg-transparent text-text-muted hover:text-text-secondary"
                  }
                `}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Date */}
          <span className="text-text-secondary text-xs font-mono hidden sm:block">
            {formatDate()}
          </span>
        </div>
      </div>

      {/* ── Metric Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <MetricStatBlock key={s.title} {...s} />
        ))}
      </div>

      {/* ── Middle Row: Chart + Side Panels ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Bar Chart — col-span-8 */}
        <div className="lg:col-span-8">
          <Panel
            title="Pipeline Activity"
            headerAction={<StatusBadge variant="tag">Monthly</StatusBadge>}
          >
            {isLoading ? (
              <div className="h-[220px] flex items-center justify-center text-text-muted text-xs">
                Loading chart...
              </div>
            ) : pipelineActivity.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-text-muted text-xs">
                No pipeline data yet
              </div>
            ) : (
              <MiniBarChart
                data={pipelineActivity}
                activeIndex={activeBarIndex}
                height={220}
              />
            )}
          </Panel>
        </div>

        {/* Right Column — col-span-4 */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Recent Projects */}
          <Panel
            title="Recent Projects"
            headerAction={
              <Link
                href="/projects"
                className="text-primary text-[10px] uppercase tracking-wider font-medium hover:text-primary-hover transition-colors"
              >
                View All
              </Link>
            }
          >
            {isLoading ? (
              <p className="text-text-muted text-xs">Loading...</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(data?.recent_projects ?? []).slice(0, 5).map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/projects/${proj.id}`}
                    className="flex items-center justify-between hover:bg-bg-elevated/50 -mx-2 px-2 py-1.5 rounded-sm transition-colors"
                  >
                    <div>
                      <p className="text-text-primary text-xs font-mono font-semibold">
                        {proj.name}
                      </p>
                      <p className="text-text-muted text-[10px] font-mono">
                        {new Date(proj.updated_at).toLocaleDateString("en-AU", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <span className="text-text-secondary text-[10px] font-mono">
                      {proj.survey_count} {proj.survey_count === 1 ? "survey" : "surveys"}
                    </span>
                  </Link>
                ))}
                {(data?.recent_projects ?? []).length === 0 && (
                  <p className="text-text-muted text-xs text-center py-2">No projects yet</p>
                )}
              </div>
            )}
          </Panel>

          {/* Pipeline Health */}
          <Panel title="Pipeline Health">
            {isLoading ? (
              <div className="h-[120px] flex items-center justify-center text-text-muted text-xs">
                Loading...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-2">
                <CircularProgress
                  value={pipelineHealth}
                  variant="primary"
                  size={80}
                  strokeWidth={6}
                />
                <div className="w-full flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[10px] uppercase tracking-wider">Completed</span>
                    <span className="text-success text-xs font-mono">{pipelineCounts.complete}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[10px] uppercase tracking-wider">Processing</span>
                    <span className="text-primary text-xs font-mono">{pipelineCounts.processing}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[10px] uppercase tracking-wider">Failed</span>
                    <span className="text-error text-xs font-mono">{pipelineCounts.failed}</span>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ── Survey Pipeline Table ──────────────────────── */}
      <Panel
        title="Survey Pipeline"
        noPadding
        headerAction={
          <Link href="/surveys/upload">
            <AppButton variant="ghost" size="sm" endIcon={<ArrowUpRight size={12} />}>
              View All
            </AppButton>
          </Link>
        }
      >
        {isLoading ? (
          <div className="p-6 text-text-muted text-xs text-center">Loading pipeline...</div>
        ) : (
          <DataTable
            columns={pipelineColumns}
            data={pipelineRows}
            emptyMessage="No surveys in pipeline."
          />
        )}
      </Panel>
    </div>
  );
}
