// Operational /home dashboard.
//
// Intent (from the PRD): this is the operator's first screen at 6 AM and it
// must answer "what broke overnight?" in under two seconds. That shapes every
// layout choice below:
//
//   - Status strip is the *first* thing in the fold: one glance tells the
//     operator whether variance, pipeline, or sync are green.
//   - KPI row quantifies the same story — four large numbers, not eight
//     medium ones, so the eye doesn't have to compare columns.
//   - The trend + donut row gives context: where has tonnage moved over the
//     past year and how is the pipeline distributed right now.
//   - Pipeline table + activity feed are the drill-down surfaces.
//   - Shortcut row at the bottom is muscle memory — the six most common
//     next actions, all one click away.
//
// Every data-bound section reads a single TanStack query from
// `useHomeDashboard()`. That means each card renders its own Skeleton while
// its query is `isLoading` and its own inline "retry" card when `isError` —
// a flaky endpoint never blocks the rest of the page.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Box,
  FileDown,
  Package,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { apiClient } from "@/lib/http";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import type {
  ActivityEvent,
  PipelineRow,
  ProcessingStatus,
  ProjectMaterial,
  TemporalSnapshot,
} from "@/types/api";

// ── Helpers ──────────────────────────────────────────────────────────────

const TIME_RANGES = ["Day", "Week", "Month", "Year"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

// RANGE_DAYS maps each tab to its lookback window in days. The server
// auto-picks bucket width (daily ≤7d, weekly ≤90d, monthly otherwise)
// from the actual span of the range, so we only have to decide how far
// back to look — not how to aggregate.
const RANGE_DAYS: Record<TimeRange, number> = {
  Day: 1,
  Week: 7,
  Month: 30,
  Year: 365,
};

// rangeToISO converts a tab selection into the `{startDate, endDate}`
// pair consumed by useHomeDashboard / useDashboardSummary. We anchor
// `endDate` at call time rather than "now" inside the hook so the
// React-Query cache key stays stable across renders within a single
// user-visible window (re-compute on tab change, not on re-render).
function rangeToISO(range: TimeRange, anchor: number): {
  startDate: string;
  endDate: string;
} {
  const end = new Date(anchor);
  const start = new Date(anchor - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

// EXPORT_KINDS drives the real CSV download dropdown. Each entry maps
// to a `kind` the backend `/api/v1/reports/export` handler accepts.
// `projectRequired` is surfaced to the UI so we can disable items that
// would 400 — e.g. inventory is client-wide and works without a
// project, but reconciliation and trends both need `project_id`.
const EXPORT_KINDS = [
  {
    kind: "reconciliation" as const,
    label: "Reconciliation",
    projectRequired: true,
    materialRequired: false,
  },
  {
    kind: "inventory" as const,
    label: "Inventory summary",
    projectRequired: false,
    materialRequired: false,
  },
  {
    kind: "trends" as const,
    label: "Trend history",
    projectRequired: true,
    materialRequired: true,
  },
];

// downloadCSV POSTs to the export endpoint with a blob response, then
// triggers a synthetic <a download> click to save the file. Kept inline
// (not in useHomeDashboard) because it's a side-effectful imperative
// flow — the hook is for data, not I/O triggers.
async function downloadCSV(body: {
  kind: "reconciliation" | "inventory" | "trends";
  project_id?: string;
  material?: string;
  start_date?: string;
  end_date?: string;
}): Promise<void> {
  const res = await apiClient.post<Blob>("/api/v1/reports/export", body, {
    responseType: "blob",
    headers: { Accept: "text/csv" },
  });
  // apiClient returns {data, status}; axios with responseType:"blob" puts
  // the Blob in `data`. We wrap in URL.createObjectURL and trigger a
  // hidden <a> click — the browser handles the save dialog. The URL is
  // revoked on the next tick to free memory.
  const blob =
    res.data instanceof Blob
      ? res.data
      : new Blob([res.data as BlobPart], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${body.kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so Firefox has time to read the href.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// formatTonnes compresses very large tonnage numbers into "1.24 Mt" etc. so
// the KPI tile is readable on a 13" laptop. Anything below a tonne we just
// show raw (those are edge cases — rounding would be misleading).
function formatTonnes(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} Mt`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)} kt`;
  return `${v.toFixed(1)} t`;
}

function formatVolumeM3(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} Mm³`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)} km³`;
  return `${v.toFixed(1)} m³`;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// statusBadge returns the `{variant,label}` a pipeline row should render as.
// Keeping it pure so unit tests (future) can pin each enum to a variant.
function statusBadge(
  status: string,
): { variant: "default" | "secondary" | "outline" | "destructive"; label: string } {
  switch (status) {
    case "complete":
      return { variant: "default", label: "Complete" };
    case "processing":
      return { variant: "secondary", label: "Processing" };
    case "failed":
      return { variant: "destructive", label: "Failed" };
    case "queued":
    default:
      return { variant: "outline", label: status || "Queued" };
  }
}

// severityTint maps an activity severity to a background colour for the
// avatar disc + badge variant. Keeping it one place so the feed row stays
// declarative.
function severityTint(sev: ActivityEvent["severity"]): {
  bg: string;
  badge: "default" | "secondary" | "outline" | "destructive";
} {
  switch (sev) {
    case "critical":
      return { bg: "bg-destructive/15 text-destructive", badge: "destructive" };
    case "warning":
      return { bg: "bg-amber-500/15 text-amber-700 dark:text-amber-400", badge: "secondary" };
    case "info":
    default:
      return { bg: "bg-muted text-muted-foreground", badge: "outline" };
  }
}

function initialsFor(title: string): string {
  const parts = title.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "•";
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [range, setRange] = useState<TimeRange>("Year");
  const [selectedMaterial, setSelectedMaterial] = useState<string | undefined>(
    undefined,
  );

  // rangeAnchor freezes the end-of-window at tab-switch time so React-Query
  // keys stay stable across renders. useState's lazy initializer gives us a
  // fresh anchor each time the user picks a new tab.
  const [rangeAnchor, setRangeAnchor] = useState<number>(() => Date.now());
  const isoRange = useMemo(
    () => rangeToISO(range, rangeAnchor),
    [range, rangeAnchor],
  );

  const {
    summary,
    inventory,
    activity,
    processing,
    reconciliation,
    materials,
    trends,
    varianceCount,
    lastSurveyDelta,
    latestProjectId,
    effectiveMaterial,
  } = useHomeDashboard({
    range: isoRange,
    selectedMaterial,
  });

  const handleRangeChange = (next: TimeRange) => {
    setRange(next);
    setRangeAnchor(Date.now());
  };

  const s = summary.data;
  const inv = inventory.data;
  const proc = processing.data;

  const pipelineRows = (s?.pipeline_rows ?? []) as PipelineRow[];
  const pipelineCounts = s?.pipeline_counts ?? { complete: 0, processing: 0, failed: 0 };
  const pipelineHealth = s?.pipeline_health_pct ?? 0;
  const alertCount = s?.alert_count ?? 0;

  const trendPoints = trends.data ?? [];
  const materialOptions = materials.data?.materials ?? [];

  return (
    <TooltipProvider delay={200}>
      <div className="flex flex-col gap-6 p-6">
        <HeaderRow
          latestSync={inv?.latest_survey_date ?? s?.recent_projects?.[0]?.latest_survey_date ?? null}
          range={range}
          onRangeChange={handleRangeChange}
          exportContext={{
            projectId: latestProjectId,
            material: effectiveMaterial,
            startDate: isoRange.startDate,
            endDate: isoRange.endDate,
          }}
        />

        <StatusStrip
          alertCount={alertCount}
          processing={proc}
          processingLoading={processing.isLoading}
          lastSync={inv?.latest_survey_date ?? null}
        />

        <section
          aria-label="Key performance indicators"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiTotalInventory
            loading={inventory.isLoading}
            error={inventory.isError}
            onRetry={() => inventory.refetch()}
            tonnage={inv?.total_tonnage}
            volumeM3={inv?.total_volume_m3}
            stockpileCount={inv?.stockpile_count}
            deltaPct={lastSurveyDelta?.pct}
          />
          <KpiActiveProcessing
            loading={processing.isLoading}
            error={processing.isError}
            onRetry={() => processing.refetch()}
            processing={proc}
          />
          <KpiVarianceFlags
            loading={reconciliation.isLoading && !reconciliation.data}
            error={reconciliation.isError}
            onRetry={() => reconciliation.refetch()}
            varianceCount={varianceCount}
            totalSurveyed={(reconciliation.data ?? []).length}
          />
          <KpiLastSurveyDelta
            loading={trends.isLoading && !trends.data}
            error={trends.isError}
            onRetry={() => trends.refetch()}
            delta={lastSurveyDelta}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <InventoryTrendCard
            className="lg:col-span-8"
            loading={trends.isLoading}
            error={trends.isError}
            onRetry={() => trends.refetch()}
            points={trendPoints}
            fallbackActivity={s?.pipeline_activity ?? []}
            materials={materialOptions}
            selectedMaterial={effectiveMaterial}
            onMaterialChange={setSelectedMaterial}
            rangeLabel={range}
          />
          <VarianceDonutCard
            className="lg:col-span-4"
            counts={pipelineCounts}
            healthPct={pipelineHealth}
            loading={summary.isLoading}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <PipelineTableCard
            className="lg:col-span-8"
            rows={pipelineRows}
            loading={summary.isLoading}
            error={summary.isError}
            onRetry={() => summary.refetch()}
          />
          <ActivityFeedCard
            className="lg:col-span-4"
            events={activity.data ?? []}
            loading={activity.isLoading}
            error={activity.isError}
            onRetry={() => activity.refetch()}
          />
        </section>

        <ShortcutRow />
      </div>
    </TooltipProvider>
  );
}

// ── Header ───────────────────────────────────────────────────────────────

function HeaderRow({
  latestSync,
  range,
  onRangeChange,
  exportContext,
}: {
  latestSync: string | null;
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
  exportContext: {
    projectId: string | undefined;
    material: string | undefined;
    startDate: string;
    endDate: string;
  };
}) {
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const triggerExport = async (kind: "reconciliation" | "inventory" | "trends") => {
    setExportErr(null);
    setExporting(kind);
    try {
      await downloadCSV({
        kind,
        project_id: kind !== "inventory" ? exportContext.projectId : undefined,
        material: kind === "trends" ? exportContext.material : undefined,
        start_date: kind === "trends" ? exportContext.startDate : undefined,
        end_date: kind === "trends" ? exportContext.endDate : undefined,
      });
    } catch (e) {
      setExportErr(
        `Export failed — see console or retry with a different ${kind === "trends" ? "material/range" : "project"}.`,
      );
      console.error("export failed", e);
    } finally {
      setExporting(null);
    }
  };

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
        <p className="text-sm text-muted-foreground">
          Last sync {formatRelative(latestSync)}
          {" · "}
          {new Date().toLocaleDateString("en-AU", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
        {exportErr ? (
          <p className="mt-1 text-xs text-destructive">{exportErr}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {/* Range tabs are wired to a real date-range query param on
            /dashboard/summary and the trends endpoint. Switching tabs
            refetches both with the new window. */}
        <Tabs value={range} onValueChange={(v) => onRangeChange(v as TimeRange)}>
          <TabsList>
            {TIME_RANGES.map((r) => (
              <TabsTrigger key={r} value={r}>
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            <FileDown className="size-3.5" />
            Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {EXPORT_KINDS.map((k) => {
              const disabled =
                exporting != null ||
                (k.projectRequired && !exportContext.projectId) ||
                (k.materialRequired && !exportContext.material);
              return (
                <DropdownMenuItem
                  key={k.kind}
                  disabled={disabled}
                  onClick={() => triggerExport(k.kind)}
                >
                  {exporting === k.kind ? `${k.label} …` : k.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// ── Status strip ─────────────────────────────────────────────────────────

function StatusStrip({
  alertCount,
  processing,
  processingLoading,
  lastSync,
}: {
  alertCount: number;
  processing: ProcessingStatus | undefined;
  processingLoading: boolean;
  lastSync: string | null;
}) {
  const alertTone = alertCount > 0 ? "destructive" : "outline";
  const failed24h = processing?.failed_24h ?? 0;
  const active = processing?.active_count ?? 0;
  // Pipeline is "healthy" when no failures in the last 24h and at least
  // one job is running — mirrors the pulse the operator wants at 6 AM.
  const pipelineTone: "default" | "destructive" | "outline" =
    failed24h > 0 ? "destructive" : active > 0 ? "default" : "outline";
  const pipelineLabel =
    failed24h > 0 ? "Failures" : active > 0 ? "Active" : "Idle";

  return (
    <section
      aria-label="System status"
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-destructive/10 p-2 text-destructive">
              <AlertCircle className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open alerts</p>
              <p className="text-sm font-medium tabular-nums">{alertCount}</p>
            </div>
          </div>
          <Badge variant={alertTone}>{alertCount > 0 ? "Action" : "Clear"}</Badge>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2 text-muted-foreground">
              <Activity className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pipeline</p>
              <p className="text-sm font-medium tabular-nums">
                {processingLoading
                  ? "—"
                  : `${active} active · ${failed24h} failed (24h)`}
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={<Badge variant={pipelineTone}>{pipelineLabel}</Badge>}
            />
            <TooltipContent>
              {processing
                ? `${processing.queued_count} queued · ${processing.running_count} running · last completion ${formatRelative(processing.last_completion)}`
                : "Pipeline stats unavailable"}
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2 text-muted-foreground">
              <Package className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last survey</p>
              <p className="text-sm font-medium">{formatRelative(lastSync)}</p>
            </div>
          </div>
          <Badge variant="outline">Sync</Badge>
        </CardContent>
      </Card>
    </section>
  );
}

// ── KPI tiles ────────────────────────────────────────────────────────────

function KpiShell({
  labelId,
  icon,
  label,
  loading,
  error,
  onRetry,
  children,
  footer,
}: {
  labelId: string;
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card aria-labelledby={labelId}>
      <CardHeader>
        <CardDescription id={labelId} className="flex items-center gap-1.5">
          {icon}
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            failed
            {onRetry ? (
              <Button variant="ghost" size="xs" onClick={onRetry}>
                retry
              </Button>
            ) : null}
          </div>
        ) : (
          children
        )}
      </CardContent>
      {footer ? <CardFooter className="text-xs">{footer}</CardFooter> : null}
    </Card>
  );
}

function KpiTotalInventory({
  loading,
  error,
  onRetry,
  tonnage,
  volumeM3,
  stockpileCount,
  deltaPct,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  tonnage: number | undefined;
  volumeM3: number | undefined;
  stockpileCount: number | undefined;
  deltaPct: number | undefined;
}) {
  const up = (deltaPct ?? 0) >= 0;
  return (
    <KpiShell
      labelId="kpi-inventory-label"
      icon={<Package className="size-3.5" />}
      label="Total inventory"
      loading={loading}
      error={error}
      onRetry={onRetry}
      footer={
        deltaPct != null ? (
          <Badge variant={up ? "default" : "destructive"} className="gap-1">
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {deltaPct.toFixed(1)}% vs prev survey
          </Badge>
        ) : (
          <span className="text-muted-foreground">No trend baseline yet</span>
        )
      }
    >
      <div className="text-3xl font-semibold tabular-nums">{formatTonnes(tonnage)}</div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatVolumeM3(volumeM3)} · {stockpileCount ?? 0} stockpiles
      </p>
    </KpiShell>
  );
}

function KpiActiveProcessing({
  loading,
  error,
  onRetry,
  processing,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  processing: ProcessingStatus | undefined;
}) {
  const active = processing?.active_count ?? 0;
  const failed24h = processing?.failed_24h ?? 0;
  const total24h = processing?.total_24h ?? 0;
  const completed24h = processing?.completed_24h ?? 0;

  // Break down the top-2 processors with active work so the tooltip gives
  // the operator a "which stage is busiest" hint without forcing a
  // navigation to the dedicated processing page.
  const busiest = useMemo(() => {
    if (!processing?.by_processor) return [];
    return [...processing.by_processor]
      .filter((p) => p.active > 0 || p.failed > 0)
      .sort((a, b) => b.active + b.failed - (a.active + a.failed))
      .slice(0, 4);
  }, [processing]);

  return (
    <KpiShell
      labelId="kpi-processing-label"
      icon={<Activity className="size-3.5" />}
      label="Active processing"
      loading={loading}
      error={error}
      onRetry={onRetry}
      footer={
        failed24h > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="destructive" className="gap-1">
                  {failed24h} failed in last 24h
                </Badge>
              }
            />
            <TooltipContent>
              {completed24h}/{total24h} completed · breakdown:{" "}
              {busiest.length
                ? busiest
                    .map((p) => `${p.processor_type} ${p.active}a/${p.failed}f`)
                    .join(", ")
                : "no per-processor detail"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex cursor-help items-center gap-1 text-muted-foreground underline-offset-2 hover:underline">
                  {completed24h}/{total24h} completed in 24h
                </span>
              }
            />
            <TooltipContent>
              {busiest.length
                ? busiest
                    .map((p) => `${p.processor_type} ${p.active}a/${p.failed}f`)
                    .join(", ")
                : "No processors reporting activity"}
            </TooltipContent>
          </Tooltip>
        )
      }
    >
      <div className="text-3xl font-semibold tabular-nums">{active}</div>
      <p className="mt-1 text-xs text-muted-foreground">
        {processing
          ? `${processing.queued_count} queued · ${processing.running_count} running`
          : "Awaiting pipeline telemetry"}
      </p>
    </KpiShell>
  );
}

function KpiVarianceFlags({
  loading,
  error,
  onRetry,
  varianceCount,
  totalSurveyed,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  varianceCount: number;
  totalSurveyed: number;
}) {
  const hot = varianceCount > 0;
  return (
    <KpiShell
      labelId="kpi-variance-label"
      icon={<Scale className="size-3.5" />}
      label="Variance flags"
      loading={loading}
      error={error}
      onRetry={onRetry}
      footer={
        <Badge variant={hot ? "destructive" : "outline"}>
          {hot ? `${varianceCount} needs review` : "Within threshold"}
        </Badge>
      }
    >
      <div className="text-3xl font-semibold tabular-nums">{varianceCount}</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Across {totalSurveyed} reconciliations
      </p>
    </KpiShell>
  );
}

function KpiLastSurveyDelta({
  loading,
  error,
  onRetry,
  delta,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  delta: ReturnType<typeof useHomeDashboard>["lastSurveyDelta"];
}) {
  const hasDelta = delta != null;
  const up = (delta?.absolute ?? 0) >= 0;
  return (
    <KpiShell
      labelId="kpi-delta-label"
      icon={<TrendingUp className="size-3.5" />}
      label="Last survey delta"
      loading={loading}
      error={error}
      onRetry={onRetry}
      footer={
        hasDelta ? (
          <Badge
            variant={delta!.isAnomaly ? "destructive" : up ? "default" : "secondary"}
            className="gap-1"
          >
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {delta!.pct.toFixed(1)}%
            {delta!.isAnomaly ? " · anomaly" : ""}
          </Badge>
        ) : (
          <span className="text-muted-foreground">Awaiting a second snapshot</span>
        )
      }
    >
      <div className="text-3xl font-semibold tabular-nums">
        {hasDelta ? `${up ? "+" : ""}${formatVolumeM3(delta!.absolute)}` : "—"}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">vs previous snapshot</p>
    </KpiShell>
  );
}

// ── Inventory trend ──────────────────────────────────────────────────────

const trendConfig = {
  value: { label: "Volume m³", color: "var(--chart-1, hsl(var(--primary)))" },
  activity: { label: "Pipeline activity", color: "var(--chart-2, hsl(var(--muted-foreground)))" },
} satisfies ChartConfig;

function InventoryTrendCard({
  className,
  loading,
  error,
  onRetry,
  points,
  fallbackActivity,
  materials,
  selectedMaterial,
  onMaterialChange,
  rangeLabel,
}: {
  className?: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  points: TemporalSnapshot[];
  fallbackActivity: { label: string; value: number }[];
  materials: ProjectMaterial[];
  selectedMaterial: string | undefined;
  onMaterialChange: (m: string | undefined) => void;
  rangeLabel: TimeRange;
}) {
  // Pre-compute the anomaly dots so we don't re-scan in render.
  const { series, anomalies } = useMemo(() => {
    const series = points.map((p) => ({
      timestamp: p.created_at,
      label: new Date(p.created_at).toLocaleDateString("en-AU", {
        month: "short",
        year: "2-digit",
      }),
      value: p.value,
      is_anomaly: p.is_anomaly,
    }));
    const anomalies = series.filter((p) => p.is_anomaly);
    return { series, anomalies };
  }, [points]);

  const showFallback = !loading && !error && series.length === 0;

  // The "No materials detected" hint is not purely cosmetic: it tells the
  // operator what to do next (ingest a survey with a Contours/ folder) so
  // they can make the trend card populate. Also disables the Select so we
  // don't render an empty popup.
  const noMaterials = materials.length === 0;

  return (
    <Card className={className} aria-labelledby="trend-title">
      <CardHeader>
        <CardTitle id="trend-title">Inventory trend · {rangeLabel}</CardTitle>
        <CardDescription>
          Snapshots across the selected window. Red dots mark anomalies flagged by the analytics pipeline.
        </CardDescription>
        <CardAction>
          <Select
            value={selectedMaterial ?? ""}
            onValueChange={(v) => onMaterialChange(v || undefined)}
            disabled={noMaterials}
          >
            <SelectTrigger size="sm" aria-label="Material">
              <SelectValue
                placeholder={noMaterials ? "No materials detected" : "Select material"}
              />
            </SelectTrigger>
            <SelectContent>
              {materials.map((m) => (
                <SelectItem key={m.material} value={m.material}>
                  {m.material}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : error ? (
          <InlineError onRetry={onRetry} message="Couldn't load trend data." />
        ) : showFallback ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              No trend data yet — showing pipeline activity instead.
            </p>
            <ChartContainer config={trendConfig} className="h-[260px] w-full">
              <LineChart data={fallbackActivity}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} width={32} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-activity)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </div>
        ) : (
          <ChartContainer config={trendConfig} className="h-[280px] w-full">
            <LineChart data={series}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} width={48} fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              {anomalies.map((a) => (
                <ReferenceDot
                  key={a.timestamp}
                  x={a.label}
                  y={a.value}
                  r={5}
                  fill="var(--destructive, #ef4444)"
                  stroke="var(--background, #fff)"
                  strokeWidth={1.5}
                  ifOverflow="extendDomain"
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ── Variance donut ───────────────────────────────────────────────────────

const varianceConfig = {
  complete: { label: "Complete", color: "hsl(142 70% 45%)" },
  processing: { label: "Processing", color: "hsl(217 91% 60%)" },
  failed: { label: "Failed", color: "hsl(0 84% 60%)" },
} satisfies ChartConfig;

function VarianceDonutCard({
  className,
  counts,
  healthPct,
  loading,
}: {
  className?: string;
  counts: { complete: number; processing: number; failed: number };
  healthPct: number;
  loading: boolean;
}) {
  const data = useMemo(
    () => [
      { key: "complete", value: counts.complete, fill: "var(--color-complete)" },
      { key: "processing", value: counts.processing, fill: "var(--color-processing)" },
      { key: "failed", value: counts.failed, fill: "var(--color-failed)" },
    ],
    [counts],
  );
  const isEmpty = data.every((d) => d.value === 0);

  return (
    <Card className={className} aria-labelledby="donut-title">
      <CardHeader>
        <CardTitle id="donut-title">Variance distribution</CardTitle>
        <CardDescription>Pipeline health across the current cohort.</CardDescription>
      </CardHeader>
      <CardContent className="relative">
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : isEmpty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No pipeline rows yet.
          </p>
        ) : (
          <>
            <ChartContainer config={varianceConfig} className="mx-auto aspect-square h-[220px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={data} dataKey="value" nameKey="key" innerRadius={60} outerRadius={90} strokeWidth={2}>
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="key" />} />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 top-[56px] flex flex-col items-center justify-start">
              <span className="text-3xl font-semibold tabular-nums">
                {Math.round(healthPct)}%
              </span>
              <span className="text-xs text-muted-foreground">healthy</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Pipeline table ───────────────────────────────────────────────────────

function PipelineTableCard({
  className,
  rows,
  loading,
  error,
  onRetry,
}: {
  className?: string;
  rows: PipelineRow[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className={className} aria-labelledby="pipeline-title">
      <CardHeader>
        <CardTitle id="pipeline-title">Survey pipeline</CardTitle>
        <CardDescription>Most recent ingests and their stage.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/surveys/upload" />}>
            View all
            <ArrowUpRight className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <InlineError onRetry={onRetry} message="Couldn't load pipeline." />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No surveys in pipeline.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Epoch</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const sb = statusBadge(r.status);
                return (
                  <TableRow key={`${r.project}-${r.epoch}-${i}`}>
                    <TableCell className="font-medium">{r.project}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.epoch
                        ? new Date(r.epoch).toLocaleDateString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.stage}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.duration || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Activity feed ────────────────────────────────────────────────────────

function ActivityFeedCard({
  className,
  events,
  loading,
  error,
  onRetry,
}: {
  className?: string;
  events: ActivityEvent[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className={className} aria-labelledby="activity-title">
      <CardHeader>
        <CardTitle id="activity-title">Activity feed</CardTitle>
        <CardDescription>Alerts, ingests, and project updates.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <InlineError onRetry={onRetry} message="Couldn't load activity." />
          </div>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recent activity.
          </p>
        ) : (
          <div className="max-h-[380px] overflow-y-auto">
            {events.map((e, i) => {
              const tint = severityTint(e.severity);
              return (
                <div key={`${e.timestamp}-${i}`}>
                  <div className="flex items-start gap-3 p-3">
                    <Avatar className={`size-8 ${tint.bg}`}>
                      <AvatarFallback className={tint.bg}>
                        {initialsFor(e.title)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.subtitle} · {formatRelative(e.timestamp)}
                      </p>
                    </div>
                    <Badge variant={tint.badge} className="shrink-0">
                      {e.severity}
                    </Badge>
                  </div>
                  {i < events.length - 1 ? <Separator /> : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shortcut row ─────────────────────────────────────────────────────────

function ShortcutRow() {
  // "Export" is a real CSV download — inventory is always available
  // (client-wide, no project filter needed). Ship that as the shortcut;
  // the header dropdown covers the reconciliation/trends variants that
  // need extra context.
  const [exporting, setExporting] = useState(false);

  const exportInventory = async () => {
    setExporting(true);
    try {
      await downloadCSV({ kind: "inventory" });
    } catch (e) {
      console.error("inventory export failed", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section aria-label="Shortcuts" className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" render={<Link href="/reconcile" />}>
        <Scale className="size-3.5" />
        Reconcile
      </Button>
      <Button variant="outline" size="sm" render={<Link href="/surveys/upload" />}>
        <Upload className="size-3.5" />
        Upload survey
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportInventory}
        disabled={exporting}
      >
        <FileDown className="size-3.5" />
        {exporting ? "Exporting…" : "Export inventory"}
      </Button>
      <Button variant="outline" size="sm" render={<Link href="/qa" />}>
        <ShieldCheck className="size-3.5" />
        QA review
      </Button>
      <Button variant="outline" size="sm" render={<Link href="/viewer" />}>
        <Box className="size-3.5" />
        3D viewer
      </Button>
      <Button variant="outline" size="sm" render={<Link href="/analytics" />}>
        <BarChart3 className="size-3.5" />
        Analytics
      </Button>
    </section>
  );
}

// ── Inline error banner ─────────────────────────────────────────────────

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <span className="flex items-center gap-2">
        <AlertCircle className="size-4" />
        {message}
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
