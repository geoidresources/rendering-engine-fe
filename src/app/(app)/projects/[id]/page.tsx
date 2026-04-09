"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import TabBar from "@/components/ui/TabBar";
import Panel from "@/components/ui/Panel";
import MetricStatBlock from "@/components/ui/MetricStatBlock";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import { useProject } from "@/hooks/useProjects";
import { useSurveys } from "@/hooks/useSurveys";
import { useMeasurements } from "@/hooks/useMeasurements";
import { useReconciliation } from "@/hooks/useAnalytics";
import Link from "next/link";

const TABS = ["Overview", "Surveys", "Measurements", "Reconciliation"];

function formatNum(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState(0);

  const { data: project, isLoading: loadingProject } = useProject(id);
  const { data: surveys } = useSurveys(id);
  const { data: measurements } = useMeasurements(id);
  const { data: reconciliation } = useReconciliation(id);

  if (loadingProject) {
    return (
      <PageShell title="Project Detail" description="Loading...">
        <div className="flex items-center justify-center py-20 text-text-muted text-xs">Loading project...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={project?.name ?? "Project Detail"}
      description={project?.description || "Mine site control centre"}
    >
      <TabBar tabs={TABS} activeIndex={activeTab} onChange={setActiveTab} />

      {activeTab === 0 && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-4">
            <MetricStatBlock title="Surveys" value={String(surveys?.length ?? project?.survey_count ?? 0)} />
            <MetricStatBlock title="Total Area" value={`${formatNum(project?.total_area_m2 || 0)} M²`} />
            <MetricStatBlock title="CRS" value={project?.settings?.crs ?? "EPSG:4326"} />
            <MetricStatBlock title="Status" value={project?.is_active ? "Active" : "Inactive"} />
          </div>
          {project?.settings?.coordinates && (
            (() => {
              const coords = project.settings.coordinates as Record<string, number>;
              const lat = coords?.lat ?? coords?.latitude;
              const lng = coords?.lng ?? coords?.longitude;
              return lat != null && lng != null ? (
                <Panel title="Location">
                  <p className="text-text-secondary text-xs font-mono">
                    {lat.toFixed(4)}°, {lng.toFixed(4)}°
                    {project.settings.timezone ? ` — ${project.settings.timezone}` : ""}
                  </p>
                </Panel>
              ) : null;
            })()
          )}
        </div>
      )}

      {activeTab === 1 && (
        <div className="mt-4">
          <Panel noPadding>
            <DataTable
              columns={[
                { key: "survey_date", label: "Date", mono: true },
                {
                  key: "status",
                  label: "Status",
                  render: (val: unknown) => {
                    const s = val as string;
                    const v = s === "approved" ? "active" : s === "pending" ? "alert" : "standby";
                    return <StatusBadge variant={v}>{s.replace(/_/g, " ").toUpperCase()}</StatusBadge>;
                  },
                },
                { key: "id", label: "Survey ID", mono: true },
                {
                  key: "_link",
                  label: "",
                  render: (_: unknown, row: Record<string, unknown>) => (
                    <Link href={`/surveys/${row.id}`} className="text-primary text-[10px] uppercase tracking-wider hover:text-primary-hover">
                      View
                    </Link>
                  ),
                },
              ]}
              data={(surveys ?? []).map((s) => ({
                ...s,
                survey_date: new Date(s.survey_date).toLocaleDateString(),
                _link: "",
              })) as unknown as Record<string, unknown>[]}
            />
          </Panel>
        </div>
      )}

      {activeTab === 2 && (
        <div className="mt-4">
          <Panel noPadding>
            <DataTable
              columns={[
                { key: "name", label: "Name" },
                {
                  key: "feature_type",
                  label: "Type",
                  render: (val: unknown) => <StatusBadge variant="tag">{(val as string).replace(/_/g, " ").toUpperCase()}</StatusBadge>,
                },
                { key: "is_locked", label: "Locked", render: (val: unknown) => <span>{val ? "Yes" : "No"}</span> },
              ]}
              data={(measurements ?? []) as unknown as Record<string, unknown>[]}
            />
          </Panel>
        </div>
      )}

      {activeTab === 3 && (
        <div className="mt-4">
          {(reconciliation ?? []).length === 0 ? (
            <Panel>
              <p className="text-text-muted text-sm text-center py-4">No reconciliation data available yet.</p>
            </Panel>
          ) : (
            <Panel noPadding>
              <DataTable
                columns={[
                  { key: "material", label: "Material" },
                  { key: "survey_closing_t", label: "Survey Closing (t)", mono: true, align: "right" as const },
                  { key: "mass_balance_closing_t", label: "Mass Balance (t)", mono: true, align: "right" as const },
                  {
                    key: "variance_pct",
                    label: "Variance %",
                    mono: true,
                    align: "right" as const,
                    render: (val: unknown) => {
                      const n = val as number;
                      return <span className={Math.abs(n) > 5 ? "text-error" : "text-text-secondary"}>{n.toFixed(2)}%</span>;
                    },
                  },
                  { key: "status", label: "Status", render: (val: unknown) => <StatusBadge variant="tag">{val as string}</StatusBadge> },
                ]}
                data={(reconciliation ?? []).map((r) => ({
                  ...r,
                  survey_closing_t: formatNum(r.survey_closing_t),
                  mass_balance_closing_t: formatNum(r.mass_balance_closing_t),
                })) as unknown as Record<string, unknown>[]}
              />
            </Panel>
          )}
        </div>
      )}
    </PageShell>
  );
}
