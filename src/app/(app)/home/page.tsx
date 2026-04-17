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
  Line,
  LineChart,
  ReferenceArea,
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
  ReconciliationRecord,
  ReconciliationSummary,
  StockpileZone,
  SurveyDeltaResponse,
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

// formatShortDate renders "01 Apr 2026" for a valid ISO string, or an em-dash
// if the value is null/undefined or can't be parsed. PipelineRow.epoch has
// historically come back as a bare YYYY-MM-DD but that's not a contract — be
// permissive and never show "Invalid Date".
function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// formatStageLabel turns kebab-case pipeline stage names ("stockpile-inventory",
// "vector-features") into display-friendly text ("Stockpile inventory"). The
// backend emits the raw processor name; we don't want the operator staring at
// internal identifiers.
function formatStageLabel(stage: string | null | undefined): string {
  if (!stage) return "—";
  const spaced = stage.replace(/[-_]+/g, " ").trim();
  if (!spaced) return "—";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// formatDuration hides uninformative "0s" / empty / missing durations behind an
// em-dash. The backend's stage_timing computation doesn't always land — showing
// "0s" makes every row look like it finished instantly, which is worse than
// showing nothing.
function formatDuration(d: string | null | undefined): string {
  if (!d) return "—";
  const trimmed = d.trim();
  if (!trimmed || trimmed === "0s" || trimmed === "0" || trimmed === "0ms") {
    return "—";
  }
  return trimmed;
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

// Data-freshness SLA: the operator's contract target is "survey every 72h".
// TODO: look this up per-tenant from contract_sla_hours once the BE exposes
// it; the fallback preserves today's behaviour.
const FRESHNESS_TARGET_HOURS = 72;

function freshnessBadge(iso: string | null | undefined): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (!iso) return { label: "No data", variant: "outline" };
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { label: "No data", variant: "outline" };
  const ageHours = (Date.now() - ms) / 3_600_000;
  if (ageHours <= 24) return { label: "Fresh", variant: "default" };
  if (ageHours <= FRESHNESS_TARGET_HOURS) return { label: "OK", variant: "secondary" };
  return { label: "Stale", variant: "destructive" };
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
    reconciliationSummary,
    zoneHealth,
    materials,
    trends,
    surveyDelta,
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
            summary={reconciliationSummary.data}
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
            surveyDelta={surveyDelta.data ?? null}
            fallbackActivity={s?.pipeline_activity ?? []}
            materials={materialOptions}
            selectedMaterial={effectiveMaterial}
            onMaterialChange={setSelectedMaterial}
            rangeLabel={range}
          />
          <ReconciliationDriftCard
            className="lg:col-span-4"
            records={reconciliation.data ?? []}
            summary={reconciliationSummary.data}
            loading={reconciliation.isLoading || reconciliationSummary.isLoading}
            error={reconciliation.isError || reconciliationSummary.isError}
            onRetry={() => {
              reconciliation.refetch();
              reconciliationSummary.refetch();
            }}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <AnomalyInboxCard
            className="lg:col-span-4"
            loading={trends.isLoading || surveyDelta.isLoading}
            error={trends.isError && surveyDelta.isError}
            onRetry={() => {
              trends.refetch();
              surveyDelta.refetch();
            }}
            points={trendPoints}
            surveyDelta={surveyDelta.data ?? null}
            rangeLabel={range}
            material={effectiveMaterial}
          />
          <ZoneHealthStrip
            className="lg:col-span-8"
            zones={zoneHealth.data ?? []}
            loading={zoneHealth.isLoading}
            error={zoneHealth.isError}
            onRetry={() => zoneHealth.refetch()}
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
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant={freshnessBadge(lastSync).variant}>
                  {freshnessBadge(lastSync).label}
                </Badge>
              }
            />
            <TooltipContent>
              SLA target: survey within {FRESHNESS_TARGET_HOURS}h. Fresh ≤24h · OK ≤72h · Stale &gt;72h.
            </TooltipContent>
          </Tooltip>
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
  summary,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  varianceCount: number;
  totalSurveyed: number;
  summary: ReconciliationSummary | undefined;
}) {
  const hot = varianceCount > 0;
  const awaiting = totalSurveyed === 0;
  const variancePct = summary?.variance_pct;
  const amber = summary?.amber_count ?? 0;
  const red = summary?.red_count ?? 0;
  return (
    <KpiShell
      labelId="kpi-variance-label"
      icon={<Scale className="size-3.5" />}
      label="Variance flags"
      loading={loading}
      error={error}
      onRetry={onRetry}
      footer={
        awaiting ? (
          <span className="text-muted-foreground">Awaiting reconciliation</span>
        ) : (
          <div className="flex items-center gap-1.5">
            {red > 0 ? (
              <Badge variant="destructive">{red} critical</Badge>
            ) : null}
            {amber > 0 ? (
              <Badge variant="secondary">{amber} warning</Badge>
            ) : null}
            {red === 0 && amber === 0 ? (
              <Badge variant="outline">Within threshold</Badge>
            ) : null}
          </div>
        )
      }
    >
      <div className="text-3xl font-semibold tabular-nums">
        {awaiting ? "—" : varianceCount}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {awaiting
          ? "Run reconciliation to populate"
          : variancePct != null
            ? `${variancePct.toFixed(1)}% variance across ${totalSurveyed} run${totalSurveyed === 1 ? "" : "s"}`
            : `Across ${totalSurveyed} reconciliations`}
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
  forecast: { label: "Forecast", color: "var(--chart-3, hsl(var(--muted-foreground)))" },
  activity: { label: "Pipeline activity", color: "var(--chart-2, hsl(var(--muted-foreground)))" },
} satisfies ChartConfig;

// depletionTone picks the chip colour. Red ≤30d is "act this week", amber ≤90d
// is "plan reorder", otherwise the chip is muted so it doesn't cry wolf.
function depletionTone(
  daysToDepletion: number | null,
): { variant: "destructive" | "secondary" | "outline"; label: string } {
  if (daysToDepletion == null) return { variant: "outline", label: "—" };
  if (daysToDepletion <= 30) return { variant: "destructive", label: `Depletion: ${daysToDepletion}d` };
  if (daysToDepletion <= 90) return { variant: "secondary", label: `Depletion: ${daysToDepletion}d` };
  return { variant: "outline", label: `Depletion: ${daysToDepletion}d` };
}

function InventoryTrendCard({
  className,
  loading,
  error,
  onRetry,
  points,
  surveyDelta,
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
  surveyDelta: SurveyDeltaResponse | null;
  fallbackActivity: { label: string; value: number }[];
  materials: ProjectMaterial[];
  selectedMaterial: string | undefined;
  onMaterialChange: (m: string | undefined) => void;
  rangeLabel: TimeRange;
}) {
  // Pre-compute the chart series, anomaly dots, and the depletion forecast.
  // When `points` is empty the temporal-trends processor hasn't run yet (it
  // needs ≥3 surveys to produce useful z-scores). We fall back to a 2-point
  // series built from survey-delta's latest+previous so the operator still
  // sees the real inventory move — not a placeholder pipeline chart.
  const { series, anomalies, daysToDepletion, seriesSource } = useMemo(() => {
    const base = points.map((p) => ({
      timestamp: p.created_at,
      label: new Date(p.created_at).toLocaleDateString("en-AU", {
        month: "short",
        year: "2-digit",
      }),
      value: p.value,
      is_anomaly: p.is_anomaly,
      forecast: null as number | null,
    }));
    const anomalies = base.filter((p) => p.is_anomaly);

    const last = points[points.length - 1];
    const depletionIso = last?.depletion_date ?? null;
    let daysToDepletion: number | null = null;
    let series: typeof base = base;

    if (depletionIso) {
      const depletionMs = Date.parse(depletionIso);
      if (Number.isFinite(depletionMs) && depletionMs > Date.now()) {
        daysToDepletion = Math.max(
          0,
          Math.round((depletionMs - Date.now()) / 86_400_000),
        );
        const withSeed = base.map((p, i) =>
          i === base.length - 1 ? { ...p, forecast: p.value } : p,
        );
        series = [
          ...withSeed,
          {
            timestamp: depletionIso,
            label: new Date(depletionMs).toLocaleDateString("en-AU", {
              month: "short",
              year: "2-digit",
            }),
            value: null as unknown as number,
            is_anomaly: false,
            forecast: 0,
          },
        ];
      }
    }

    if (
      base.length === 0 &&
      surveyDelta?.latest &&
      surveyDelta?.previous
    ) {
      const toPoint = (s: { survey_date: string; volume_m3: number }, flag: boolean) => ({
        timestamp: s.survey_date,
        label: new Date(s.survey_date).toLocaleDateString("en-AU", {
          month: "short",
          year: "2-digit",
        }),
        value: s.volume_m3,
        is_anomaly: flag,
        forecast: null as number | null,
      });
      series = [
        toPoint(surveyDelta.previous, false),
        toPoint(surveyDelta.latest, surveyDelta.is_anomaly),
      ];
      return {
        series,
        anomalies: surveyDelta.is_anomaly ? [series[1]] : [],
        daysToDepletion: null,
        seriesSource: "survey-delta" as const,
      };
    }

    return {
      series,
      anomalies,
      daysToDepletion,
      seriesSource: "temporal" as const,
    };
  }, [points, surveyDelta]);

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
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span>
            {seriesSource === "survey-delta"
              ? "Latest vs previous survey. Temporal trend requires ≥3 surveys."
              : "Snapshots across the selected window. Red dots mark anomalies flagged by the analytics pipeline."}
          </span>
          {daysToDepletion != null ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge variant={depletionTone(daysToDepletion).variant} className="gap-1">
                    <TrendingDown className="size-3" />
                    {depletionTone(daysToDepletion).label}
                  </Badge>
                }
              />
              <TooltipContent>
                Projected exhaustion at current trend slope. Dashed line shows the forecast.
              </TooltipContent>
            </Tooltip>
          ) : null}
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
              No surveys ingested yet for this project. Pipeline activity shown
              as a proxy until the second survey arrives.
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
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="var(--color-forecast)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
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

// ── Anomaly inbox ────────────────────────────────────────────────────────

// anomalySeverityTone picks the chip variant from the free-form severity
// string the BE emits ("low" / "medium" / "high" — we're liberal with what
// we accept so a new server-side label doesn't break the client).
function anomalySeverityTone(
  sev: string | undefined,
): "destructive" | "secondary" | "outline" {
  const s = (sev ?? "").toLowerCase();
  if (s === "high" || s === "critical") return "destructive";
  if (s === "medium" || s === "warning") return "secondary";
  return "outline";
}

// AnomalyRow is the normalised shape the card renders — temporal-snapshots
// anomalies and the last-survey-delta anomaly funnel into the same visual so
// the operator sees a single "what went sideways" list regardless of which
// analytics backend surfaced it.
type AnomalyRow = {
  key: string;
  material: string;
  timestamp: string;
  zScore: number | null;
  severity: string | undefined;
  delta: number | null;
  source: "temporal" | "survey-delta";
};

function AnomalyInboxCard({
  className,
  loading,
  error,
  onRetry,
  points,
  surveyDelta,
  rangeLabel,
  material,
}: {
  className?: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  points: TemporalSnapshot[];
  surveyDelta: SurveyDeltaResponse | null;
  rangeLabel: TimeRange;
  material: string | undefined;
}) {
  const anomalies = useMemo<AnomalyRow[]>(() => {
    const fromTrend: AnomalyRow[] = points
      .filter((p) => p.is_anomaly)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .map((p, i) => {
        const prev = i < points.length - 1 ? points[i - 1]?.value ?? null : null;
        return {
          key: p.id,
          material: p.material,
          timestamp: p.created_at,
          zScore: p.anomaly_z_score,
          severity: p.anomaly_severity,
          delta: prev != null ? p.value - prev : null,
          source: "temporal" as const,
        };
      })
      .slice(0, 3);

    if (fromTrend.length > 0) return fromTrend;

    // Survey-delta fallback: the temporal-snapshots series is often empty
    // for young tenants (the trends processor needs ≥3 surveys). survey-delta
    // runs directly on `analytics_stockpiles` and flags anomalies as soon as
    // the second survey is ingested — that's the number we surface.
    if (surveyDelta?.is_anomaly && surveyDelta.latest && surveyDelta.previous) {
      return [
        {
          key: surveyDelta.latest.survey_id,
          material: material ?? "all materials",
          timestamp: surveyDelta.latest.survey_date,
          zScore: null,
          severity: Math.abs(surveyDelta.delta_pct) >= 50 ? "high" : "medium",
          delta: surveyDelta.delta_volume_m3,
          source: "survey-delta" as const,
        },
      ];
    }
    return [];
  }, [points, surveyDelta, material]);

  return (
    <Card className={className} aria-labelledby="anomaly-title">
      <CardHeader>
        <CardTitle id="anomaly-title" className="flex items-center gap-2">
          <AlertCircle className="size-4 text-destructive" />
          Anomaly inbox
        </CardTitle>
        <CardDescription>
          Last {rangeLabel.toLowerCase()} · {material ?? "all materials"}
        </CardDescription>
        {anomalies.length > 0 ? (
          <CardAction>
            <Badge variant="destructive">{anomalies.length}</Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <InlineError onRetry={onRetry} message="Couldn't load anomalies." />
          </div>
        ) : anomalies.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No anomalies detected in last {rangeLabel.toLowerCase()}.
          </p>
        ) : (
          <div className="divide-y">
            {anomalies.map((a) => {
              const up = (a.delta ?? 0) >= 0;
              return (
                <Link
                  key={a.key}
                  href="/reconciliation"
                  className="flex items-center justify-between gap-3 p-3 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.material}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatRelative(a.timestamp)}
                      {a.zScore != null
                        ? ` · z=${a.zScore.toFixed(1)}`
                        : " · survey-delta"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.delta != null ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                      >
                        {up ? (
                          <TrendingUp className="size-3" />
                        ) : (
                          <TrendingDown className="size-3" />
                        )}
                        {formatVolumeM3(a.delta)}
                      </span>
                    ) : null}
                    <Badge variant={anomalySeverityTone(a.severity)}>
                      {a.severity || "flagged"}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Reconciliation drift ─────────────────────────────────────────────────

const driftConfig = {
  variance: { label: "Variance %", color: "var(--chart-1, hsl(var(--primary)))" },
} satisfies ChartConfig;

// classifyVariance reproduces the server's green/amber/red classifier on the
// client so we can colour the chart dots without burning another request.
// Matches the logic in analytics_thresholds (ADR 014).
function classifyVariance(
  absPct: number,
  greenPct: number,
  amberPct: number,
): "green" | "amber" | "red" {
  if (absPct <= greenPct) return "green";
  if (absPct <= amberPct) return "amber";
  return "red";
}

function ReconciliationDriftCard({
  className,
  records,
  summary,
  loading,
  error,
  onRetry,
}: {
  className?: string;
  records: ReconciliationRecord[];
  summary: ReconciliationSummary | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  // Deduplicate-and-sort the reconciliation series: one point per period_end.
  // Multiple rows per period (one per material) collapse to the row with
  // the largest absolute variance — the signal that would trip a threshold.
  const { series, criticalDays, redCount, amberCount } = useMemo(() => {
    const greenPct = summary?.thresholds?.green_pct ?? 3;
    const amberPct = summary?.thresholds?.amber_pct ?? 7;

    const perPeriod = new Map<
      string,
      { period_end: string; variance_pct: number; status: string }
    >();
    for (const r of records) {
      const key = r.period_end;
      const existing = perPeriod.get(key);
      if (!existing || Math.abs(r.variance_pct) > Math.abs(existing.variance_pct)) {
        perPeriod.set(key, {
          period_end: r.period_end,
          variance_pct: r.variance_pct,
          status: r.status,
        });
      }
    }
    const sorted = [...perPeriod.values()].sort(
      (a, b) =>
        new Date(a.period_end).getTime() - new Date(b.period_end).getTime(),
    );
    const series = sorted.map((r) => ({
      label: new Date(r.period_end).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
      }),
      period_end: r.period_end,
      variance_pct: r.variance_pct,
      abs_pct: Math.abs(r.variance_pct),
      band: classifyVariance(Math.abs(r.variance_pct), greenPct, amberPct),
    }));

    const redCount = series.filter((s) => s.band === "red").length;
    const amberCount = series.filter((s) => s.band === "amber").length;
    const criticalDays = series.filter((s) => s.band !== "green").length;

    return { series, criticalDays, redCount, amberCount };
  }, [records, summary]);

  const green = summary?.thresholds?.green_pct ?? 3;
  const amber = summary?.thresholds?.amber_pct ?? 7;
  const isEmpty = !loading && !error && series.length === 0;

  // Y-axis domain: clamp to ±(amber * 1.5) but always include any outlier
  // so a 15% row doesn't get clipped silently.
  const absMax = series.reduce((m, s) => Math.max(m, s.abs_pct), amber);
  const domainMax = Math.max(amber * 1.5, absMax * 1.1);

  return (
    <Card className={className} aria-labelledby="drift-title">
      <CardHeader>
        <CardTitle id="drift-title">Reconciliation drift</CardTitle>
        <CardDescription>
          Variance % by period · green band ≤{green}% · red &gt;{amber}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : error ? (
          <InlineError onRetry={onRetry} message="Couldn't load reconciliation drift." />
        ) : isEmpty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No reconciliation runs yet.
          </p>
        ) : (
          <ChartContainer config={driftConfig} className="h-[220px] w-full">
            <LineChart data={series}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={32}
                fontSize={11}
                domain={[-domainMax, domainMax]}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceArea y1={-green} y2={green} fill="hsl(142 70% 45%)" fillOpacity={0.08} />
              <ReferenceArea y1={green} y2={amber} fill="hsl(48 96% 53%)" fillOpacity={0.1} />
              <ReferenceArea y1={-amber} y2={-green} fill="hsl(48 96% 53%)" fillOpacity={0.1} />
              <ReferenceArea y1={amber} y2={domainMax} fill="hsl(0 84% 60%)" fillOpacity={0.1} />
              <ReferenceArea y1={-domainMax} y2={-amber} fill="hsl(0 84% 60%)" fillOpacity={0.1} />
              <Line
                type="monotone"
                dataKey="variance_pct"
                stroke="var(--color-variance)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              {series
                .filter((s) => s.band === "red")
                .map((s) => (
                  <ReferenceDot
                    key={s.period_end}
                    x={s.label}
                    y={s.variance_pct}
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
      {!isEmpty && !loading && !error ? (
        <CardFooter className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {criticalDays} / {series.length} periods out of threshold
          </span>
          <span className="flex items-center gap-2">
            {redCount > 0 ? <Badge variant="destructive">{redCount} red</Badge> : null}
            {amberCount > 0 ? <Badge variant="secondary">{amberCount} amber</Badge> : null}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}

// ── Zone health strip ────────────────────────────────────────────────────

// zoneTone picks the pill colour from the zone's ratio of tonnage vs the
// fleet-wide mean. Zones pulling above 150% of mean are "hot" (likely the
// most-active pit), zones below 30% are "cold" (possibly stale). Everything
// else is "steady". This is a visual hint, not a threshold breach — the
// real breach surface is the reconciliation drift card.
function zoneTone(
  zoneTonnage: number,
  meanTonnage: number,
): { variant: "default" | "secondary" | "destructive" | "outline"; label: string } {
  if (meanTonnage <= 0) return { variant: "outline", label: "—" };
  const ratio = zoneTonnage / meanTonnage;
  if (ratio >= 1.5) return { variant: "destructive", label: "Hot" };
  if (ratio <= 0.3) return { variant: "secondary", label: "Cold" };
  return { variant: "default", label: "Steady" };
}

function ZoneHealthStrip({
  className,
  zones,
  loading,
  error,
  onRetry,
}: {
  className?: string;
  zones: StockpileZone[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const meanTonnage = useMemo(() => {
    if (zones.length === 0) return 0;
    return zones.reduce((s, z) => s + z.total_tonnage, 0) / zones.length;
  }, [zones]);

  if (loading) {
    return (
      <section aria-label="Zone health" className={className}>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-56 shrink-0" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Zone health" className={className}>
        <InlineError onRetry={onRetry} message="Couldn't load zone health." />
      </section>
    );
  }

  // Single-zone (or zero-zone) tenants don't need the strip — the KPIs
  // already cover the whole site. Rendering a one-tile strip would just be
  // noise, so we bail out entirely.
  if (zones.length < 2) return null;

  return (
    <section aria-label="Zone health" className={className}>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {zones.map((z) => {
          const tone = zoneTone(z.total_tonnage, meanTonnage);
          return (
            <Card key={z.zone} size="sm" className="w-56 shrink-0">
              <CardContent className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium" title={z.zone}>
                    {z.zone}
                  </span>
                  <Badge variant={tone.variant}>{tone.label}</Badge>
                </div>
                <span className="text-lg font-semibold tabular-nums">
                  {formatTonnes(z.total_tonnage)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {z.pile_count} stockpiles · {formatVolumeM3(z.total_volume_m3)}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
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
          <Button variant="ghost" size="sm" render={<Link href="/projects" />}>
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
                    <TableCell className="min-w-0 max-w-[220px] truncate font-medium">
                      {r.project}
                    </TableCell>
                    <TableCell className="min-w-0 truncate text-muted-foreground">
                      {formatShortDate(r.epoch)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatStageLabel(r.stage)}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDuration(r.duration)}
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
      <Button variant="outline" size="sm" render={<Link href="/reconciliation" />}>
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
      <Button variant="outline" size="sm" render={<Link href="/viewer-3d" />}>
        <Box className="size-3.5" />
        3D viewer
      </Button>
      <Button variant="outline" size="sm" render={<Link href="/reports" />}>
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
