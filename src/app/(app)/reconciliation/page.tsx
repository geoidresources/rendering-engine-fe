"use client";

import MetricStatBlock from "@/components/ui/MetricStatBlock";
import DataTable from "@/components/ui/DataTable";
import Panel from "@/components/ui/Panel";
import ProgressBar from "@/components/ui/ProgressBar";
import StatusBadge from "@/components/ui/StatusBadge";
import { useProjects } from "@/hooks/useProjects";
import { useSurveys } from "@/hooks/useSurveys";
import { useReconciliation, useStockpilesByZone } from "@/hooks/useAnalytics";

function formatNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function ReconciliationPage() {
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id ?? "";
  const { data: surveys } = useSurveys(projectId);
  const surveyId = surveys?.[0]?.id ?? "";

  const { data: reconciliation, isLoading: loadingRecon } = useReconciliation(projectId);
  const { data: zones, isLoading: loadingZones } = useStockpilesByZone(surveyId);

  const totalSurveyClosing = (reconciliation ?? []).reduce((s, r) => s + r.survey_closing_t, 0);
  const totalMassBalance = (reconciliation ?? []).reduce((s, r) => s + r.mass_balance_closing_t, 0);
  const totalVariance = totalSurveyClosing - totalMassBalance;
  const variancePct = totalMassBalance !== 0 ? ((totalVariance / totalMassBalance) * 100) : 0;

  const volumeStats = [
    { title: "Survey Closing", value: formatNum(totalSurveyClosing), unit: "t", subtitle: "Measured stock" },
    { title: "Mass Balance", value: formatNum(totalMassBalance), unit: "t", subtitle: "Calculated closing" },
    { title: "Net Variance", value: formatNum(totalVariance), unit: "t", subtitle: "Survey − Balance" },
    { title: "Variance %", value: `${variancePct.toFixed(2)}%`, subtitle: reconciliation?.length ? `${reconciliation.length} materials` : "No data" },
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
      render: (val: unknown) => {
        const n = val as number;
        return <span className={Math.abs(n) > 5 ? "text-error" : "text-text-secondary"}>{n.toFixed(2)}%</span>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (val: unknown) => {
        const s = val as string;
        return <StatusBadge variant={s === "approved" ? "active" : "standby"}>{s?.toUpperCase() ?? "PENDING"}</StatusBadge>;
      },
    },
  ];

  const isLoading = loadingRecon || loadingZones;

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-accent text-[10px] uppercase tracking-wider font-medium">Analytics Engine</p>
          <h1 className="text-text-primary text-2xl font-bold uppercase tracking-wider mt-1">
            Reconciliation Analytics
          </h1>
        </div>
        {surveys?.[0] && (
          <Panel className="!p-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-text-muted text-[10px] uppercase tracking-wider">Survey</p>
                <p className="text-primary text-xs font-mono font-semibold">{new Date(surveys[0].survey_date).toLocaleDateString()}</p>
              </div>
              <StatusBadge variant="active">{surveys[0].status.toUpperCase()}</StatusBadge>
            </div>
          </Panel>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {volumeStats.map((stat) => (
          <MetricStatBlock key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 flex flex-col gap-4">
          {/* Material Reconciliation */}
          <Panel title="Material Reconciliation" noPadding>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-text-muted text-xs">Loading...</div>
            ) : (
              <DataTable columns={reconColumns} data={(reconciliation ?? []) as unknown as Record<string, unknown>[]} />
            )}
          </Panel>

          {/* Zone Breakdown */}
          <Panel title="Zone-by-Zone Breakdown" noPadding>
            {loadingZones ? (
              <div className="flex items-center justify-center py-12 text-text-muted text-xs">Loading...</div>
            ) : (
              <DataTable columns={zoneColumns} data={(zones ?? []) as unknown as Record<string, unknown>[]} />
            )}
          </Panel>
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          {/* Variance Heat Map */}
          <Panel title="Variance Heat Map" headerAction={<StatusBadge variant="active">Live Feed</StatusBadge>}>
            <div className="relative aspect-[4/3] bg-bg-elevated rounded overflow-hidden">
              {/* Gradient-based variance visualization (matches Figma page 9) */}
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
              <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] font-mono text-text-muted">
                <span>Cut (−)</span>
                <span>Neutral</span>
                <span>Fill (+)</span>
              </div>
              {/* Color ramp legend */}
              <div className="absolute bottom-8 left-2 right-2 h-1.5 rounded-full" style={{
                background: 'linear-gradient(90deg, #ef4444, #fbbf24, #22c55e, #3b82f6)',
              }} />
            </div>
          </Panel>

          <Panel title="Volume Distribution">
            <div className="flex flex-col gap-4">
              {(zones ?? []).slice(0, 5).map((z) => {
                const maxVol = Math.max(...(zones ?? []).map((zz) => zz.total_volume_m3), 1);
                const pct = (z.total_volume_m3 / maxVol) * 100;
                return (
                  <div key={z.zone}>
                    <ProgressBar value={pct} variant="primary" label={`Zone ${z.zone}`} showPercentage />
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Total Zones</span>
                <span className="text-primary text-xs font-mono">{zones?.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Materials Tracked</span>
                <span className="text-text-secondary text-xs font-mono">{reconciliation?.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">System Status</span>
                <span className="text-success text-xs font-mono uppercase">All Nodes Nominal</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
