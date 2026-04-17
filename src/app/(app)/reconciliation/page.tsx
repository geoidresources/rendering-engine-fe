"use client";

import Link from "next/link";
import DataTable from "@/components/ui/DataTable";
import MetricCard from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import RunReconciliationPopover from "@/components/reconciliation/RunReconciliationPopover";
import ThresholdsPopover from "@/components/reconciliation/ThresholdsPopover";
import { useProjects } from "@/hooks/useProjects";
import { useSurveys } from "@/hooks/useSurveys";
import { useReconciliation, useStockpilesByZone } from "@/hooks/useAnalytics";
import {
  useProjectMaterials,
  useReconciliationSummary,
} from "@/hooks/useReconciliation";

function formatNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function classifyRow(variancePct: number, greenUpper: number, amberUpper: number): "green" | "amber" | "red" {
  const abs = Math.abs(variancePct);
  if (abs <= greenUpper) return "green";
  if (abs <= amberUpper) return "amber";
  return "red";
}

export default function ReconciliationPage() {
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id ?? "";
  const { data: surveys, isLoading: loadingSurveys } = useSurveys(projectId);
  const surveyId = surveys?.[0]?.id ?? "";

  const { data: reconciliation, isLoading: loadingRecon } = useReconciliation(projectId);
  const { data: zones, isLoading: loadingZones } = useStockpilesByZone(surveyId);
  const { data: summary } = useReconciliationSummary(projectId);
  const { data: materials } = useProjectMaterials(projectId);

  const hasProjects = !!projects?.length;
  const hasSurveys = !loadingSurveys && !!surveys?.length;

  // Thresholds drive per-row variance badges. Fall back to the seeded
  // __default__ (3 / 7) when the summary query has not resolved yet so the
  // table still renders something defensible instead of a NaN ternary.
  const greenUpper = summary?.thresholds.green_pct ?? 3;
  const amberUpper = summary?.thresholds.amber_pct ?? 7;

  const volumeStats = summary
    ? [
      { title: "Survey Closing", value: formatNum(summary.total_survey_t), unit: "t", subtitle: "Measured stock" },
      { title: "Mass Balance", value: formatNum(summary.total_balance_t), unit: "t", subtitle: "Calculated closing" },
      { title: "Net Variance", value: formatNum(summary.total_survey_t - summary.total_balance_t), unit: "t", subtitle: "Survey − Balance" },
      {
        title: "Variance %",
        value: `${summary.variance_pct.toFixed(2)}%`,
        subtitle: `${summary.green_count}G · ${summary.amber_count}A · ${summary.red_count}R`,
      },
    ]
    : [
      { title: "Survey Closing", value: "—", subtitle: "Awaiting run" },
      { title: "Mass Balance", value: "—", subtitle: "Awaiting run" },
      { title: "Net Variance", value: "—", subtitle: "Awaiting run" },
      { title: "Variance %", value: "—", subtitle: "Awaiting run" },
    ];

  const zoneColumns = [
    { key: "zone", label: "Zone", mono: true },
    { key: "pile_count", label: "Piles", mono: true, align: "right" as const },
    { key: "total_volume_m3", label: "Volume (M³)", mono: true, align: "right" as const, render: (val: unknown) => <span>{formatNum(val as number)}</span> },
    { key: "total_tonnage", label: "Tonnage (t)", mono: true, align: "right" as const, render: (val: unknown) => <span>{formatNum(val as number)}</span> },
    { key: "total_area_m2", label: "Area (M²)", mono: true, align: "right" as const, render: (val: unknown) => <span>{formatNum(val as number)}</span> },
  ];

  const reconColumns = [
    { key: "material", label: "Material" },
    { key: "client_opening_stock_t", label: "Opening (t)", mono: true, align: "right" as const, render: (val: unknown) => <span>{formatNum(val as number)}</span> },
    { key: "client_mined_t", label: "Mined (t)", mono: true, align: "right" as const, render: (val: unknown) => <span>{formatNum(val as number)}</span> },
    { key: "client_dispatched_t", label: "Dispatched (t)", mono: true, align: "right" as const, render: (val: unknown) => <span>{formatNum(val as number)}</span> },
    { key: "survey_closing_t", label: "Survey (t)", mono: true, align: "right" as const, render: (val: unknown) => <span>{formatNum(val as number)}</span> },
    {
      key: "variance_pct",
      label: "Var %",
      mono: true,
      align: "right" as const,
      // Colour depends on the *tenant's* thresholds, not a hard-coded 5 %
      // cutoff. When ThresholdsPopover saves new bands this column
      // re-classifies on the next summary poll.
      render: (val: unknown) => {
        const n = val as number;
        const band = classifyRow(n, greenUpper, amberUpper);
        const cls = band === "green" ? "text-success" : band === "amber" ? "text-warning" : "text-destructive";
        return <span className={cls}>{n.toFixed(2)}%</span>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (val: unknown) => {
        const s = val as string;
        return <Badge variant={s === "approved" ? "active" : "standby"}>{s?.toUpperCase() ?? "PENDING"}</Badge>;
      },
    },
  ];

  const isLoading = loadingRecon || loadingZones;

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-accent text-[10px] uppercase tracking-wider font-medium">Analytics Engine</p>
          <h1 className="text-foreground text-2xl font-bold uppercase tracking-wider mt-1">
            Reconciliation Analytics
          </h1>
          {summary?.last_run && (
            <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider mt-1">
              Last run {new Date(summary.last_run).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RunReconciliationPopover
            projectId={projectId}
            materials={materials ?? []}
            disabled={!hasSurveys}
          />
          <ThresholdsPopover />
          {surveys?.[0] && (
            <Card className="rounded-sm ring-0 gap-0 py-0">
              <CardContent className="p-3">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Survey</p>
                    <p className="text-primary text-xs font-mono font-semibold">{new Date(surveys[0].survey_date).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="active">{surveys[0].status.toUpperCase()}</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {hasProjects && !hasSurveys ? (
        <Card className="rounded-sm ring-0 gap-0 py-0">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <h3 className="text-foreground text-lg font-bold uppercase tracking-wider">No survey ingested yet</h3>
            <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider max-w-md">
              Reconciliation runs against ingested surveys. Upload one to begin tracking variance.
            </p>
            <Link
              href="/surveys/upload"
              className="text-primary text-xs font-medium uppercase tracking-wider font-mono mt-2 hover:underline"
            >
              Upload first survey →
            </Link>
          </CardContent>
        </Card>
      ) : (
      <>
      <div className="grid grid-cols-4 gap-4">
        {volumeStats.map((stat) => (
          <MetricCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 flex flex-col gap-4">
          <Card className="rounded-sm ring-0 gap-0 py-0 overflow-hidden">
            <CardHeader className="px-6 py-3 border-b">
              <CardTitle className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                Material Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">Loading...</div>
              ) : (
                <DataTable columns={reconColumns} data={(reconciliation ?? []) as unknown as Record<string, unknown>[]} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-sm ring-0 gap-0 py-0 overflow-hidden">
            <CardHeader className="px-6 py-3 border-b">
              <CardTitle className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                Zone-by-Zone Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingZones ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">Loading...</div>
              ) : (
                <DataTable columns={zoneColumns} data={(zones ?? []) as unknown as Record<string, unknown>[]} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          <Card className="rounded-sm ring-0 gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between px-6 py-3 border-b">
              <CardTitle className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                Variance Heat Map
              </CardTitle>
              <Badge variant="active">Live Feed</Badge>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative aspect-[4/3] bg-secondary rounded overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background: `
                      radial-gradient(ellipse at 30% 40%, rgba(239,68,68,0.6) 0%, transparent 50%),
                      radial-gradient(ellipse at 70% 60%, rgba(59,130,246,0.5) 0%, transparent 50%),
                      radial-gradient(ellipse at 50% 80%, rgba(234,179,8,0.4) 0%, transparent 40%),
                      linear-gradient(135deg, rgba(17,24,39,1) 0%, rgba(31,41,55,1) 100%)
                    `,
                  }}
                />
                <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] font-mono text-muted-foreground">
                  <span>Cut (−)</span>
                  <span>Neutral</span>
                  <span>Fill (+)</span>
                </div>
                <div className="absolute bottom-8 left-2 right-2 h-1.5 rounded-full" style={{
                  background: 'linear-gradient(90deg, #ef4444, #fbbf24, #22c55e, #3b82f6)',
                }} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm ring-0 gap-0 py-0">
            <CardHeader className="px-6 py-3 border-b">
              <CardTitle className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                Volume Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                {(zones ?? []).slice(0, 5).map((z) => {
                  const maxVol = Math.max(...(zones ?? []).map((zz) => zz.total_volume_m3), 1);
                  const pct = (z.total_volume_m3 / maxVol) * 100;
                  return (
                    <div key={z.zone} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-mono uppercase tracking-wider">
                        <span className="text-muted-foreground">Zone {z.zone}</span>
                        <span className="text-foreground/80">{Math.round(pct)}%</span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-sm ring-0 gap-0 py-0">
            <CardContent className="p-6">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Total Zones</span>
                  <span className="text-primary text-xs font-mono">{zones?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Materials Tracked</span>
                  <span className="text-foreground/80 text-xs font-mono">{reconciliation?.length ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Thresholds</span>
                  <span className="text-foreground/80 text-xs font-mono">
                    {greenUpper}% / {amberUpper}% · {summary?.thresholds.source ?? "default"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">System Status</span>
                  <span className="text-success text-xs font-mono uppercase">All Nodes Nominal</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
