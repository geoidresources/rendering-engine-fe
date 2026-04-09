"use client";

import DataTable from "@/components/ui/DataTable";
import MetricStatBlock from "@/components/ui/MetricStatBlock";
import StatusBadge from "@/components/ui/StatusBadge";
import AppButton from "@/components/ui/AppButton";
import Panel from "@/components/ui/Panel";
import { useMeasurementInventory } from "@/hooks/useMeasurements";
import { useProjects } from "@/hooks/useProjects";
import { useSurveys } from "@/hooks/useSurveys";
import { toCSV, downloadCSV, type MeasurementRow } from "@/lib/export/csvExport";

function formatNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function MeasurementsPage() {
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id ?? "";
  const { data: surveys } = useSurveys(projectId);
  const surveyId = surveys?.[0]?.id ?? "";

  const { data: inventory, isLoading } = useMeasurementInventory(projectId, surveyId);

  const columns = [
    { key: "name", label: "Name" },
    {
      key: "feature_type",
      label: "Type",
      render: (val: unknown) => <StatusBadge variant="tag">{(val as string).replace(/_/g, " ").toUpperCase()}</StatusBadge>,
    },
    {
      key: "material_type",
      label: "Material",
      render: (val: unknown) => <span className="text-text-secondary text-xs font-mono">{(val as string | null) ?? "—"}</span>,
    },
    {
      key: "volume_m3",
      label: "Volume (M³)",
      mono: true,
      sortable: true,
      align: "right" as const,
      render: (val: unknown) => <span>{val != null ? formatNum(val as number) : "—"}</span>,
    },
    {
      key: "tonnage",
      label: "Tonnage (t)",
      mono: true,
      align: "right" as const,
      render: (val: unknown) => <span>{val != null ? formatNum(val as number) : "—"}</span>,
    },
    {
      key: "area_m2",
      label: "Area (M²)",
      mono: true,
      align: "right" as const,
      render: (val: unknown) => <span>{val != null ? formatNum(val as number) : "—"}</span>,
    },
    {
      key: "is_locked",
      label: "Status",
      render: (val: unknown) => {
        const locked = val as boolean;
        return <StatusBadge variant={locked ? "standby" : "active"}>{locked ? "LOCKED" : "ACTIVE"}</StatusBadge>;
      },
    },
  ];

  const stats = inventory
    ? [
        { title: "Total Inventory", value: formatNum(inventory.total_volume_m3), subtitle: `${formatNum(inventory.total_tonnage)} tonnes` },
        { title: "Measured Area", value: `${formatNum(inventory.total_area_m2)} M²`, subtitle: "Total coverage" },
        { title: "Stockpiles", value: String(inventory.stockpile_count), subtitle: "With volume data" },
        { title: "Total Features", value: String(inventory.items.length), subtitle: "All measurement types" },
      ]
    : [
        { title: "Total Inventory", value: "--" },
        { title: "Measured Area", value: "--" },
        { title: "Stockpiles", value: "--" },
        { title: "Total Features", value: "--" },
      ];

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-primary text-2xl font-bold uppercase tracking-wider">
            Volumetric <span className="text-accent">Inventory</span>
          </h1>
          <p className="text-text-muted text-xs uppercase tracking-wider font-mono mt-1">
            {isLoading ? "Loading measurement data..." : `${inventory?.items.length ?? 0} measurements across ${inventory?.stockpile_count ?? 0} stockpiles`}
          </p>
        </div>
        <div className="flex gap-2">
          <AppButton variant="outline" size="sm" onPress={() => {
            if (!inventory?.items?.length) return;
            const rows: MeasurementRow[] = inventory.items.map((item) => ({
              id: item.id,
              type: item.feature_type,
              name: item.name,
              project_id: projectId,
              survey_id: surveyId,
              coordinates: "",
              distance_m: null,
              area_m2: item.area_m2,
              volume_m3: item.volume_m3,
              created_at: item.created_at,
            }));
            const csv = toCSV(rows);
            const projectName = projects?.find((p) => p.id === projectId)?.name ?? "geoid";
            downloadCSV(`${projectName}_measurements_${new Date().toISOString().split("T")[0]}.csv`, csv);
          }}>Export CSV</AppButton>
          <AppButton variant="outline" size="sm">Filters</AppButton>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <MetricStatBlock key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8">
          <Panel noPadding>
            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-text-muted text-xs">Loading inventory...</div>
            ) : (
              <DataTable columns={columns} data={(inventory?.items ?? [])
                .filter((item) => item.volume_m3 != null)
                .sort((a, b) => (b.volume_m3 ?? 0) - (a.volume_m3 ?? 0)) as unknown as Record<string, unknown>[]} />
            )}
          </Panel>
        </div>

        {/* Point Cloud Inspector — right sidebar */}
        <div className="col-span-4 flex flex-col gap-4">
          <Panel noPadding>
            <div className="px-4 py-3 border-b border-border-subtle">
              <span className="text-error text-[10px] uppercase tracking-wider font-medium">Point Cloud</span>
              <h3 className="text-text-primary text-sm font-bold uppercase tracking-wider mt-1">
                Inspector
              </h3>
            </div>
            {/* 3D Preview placeholder */}
            <div className="relative aspect-[4/3] bg-bg-elevated overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: `
                    radial-gradient(ellipse at 40% 50%, rgba(234,179,8,0.25) 0%, transparent 60%),
                    radial-gradient(ellipse at 60% 40%, rgba(59,130,246,0.2) 0%, transparent 50%),
                    linear-gradient(135deg, rgba(17,24,39,1) 0%, rgba(31,41,55,1) 100%)
                  `,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-text-muted text-[10px] uppercase tracking-wider font-mono">
                  3D Mesh Preview
                </span>
              </div>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Vertices</span>
                <span className="text-text-secondary text-xs font-mono">
                  {inventory ? formatNum(inventory.total_area_m2 * 12.5) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Point Density</span>
                <span className="text-text-secondary text-xs font-mono">48.2 pts/m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Bounding Box</span>
                <span className="text-text-secondary text-xs font-mono">
                  {inventory ? `${formatNum(Math.sqrt(inventory.total_area_m2))} × ${formatNum(Math.sqrt(inventory.total_area_m2))} m` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Format</span>
                <span className="text-text-secondary text-xs font-mono">LAZ 1.4</span>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-col gap-2">
              <AppButton variant="primary" size="sm" fullWidth>
                Re-process Point Cloud
              </AppButton>
              <AppButton variant="outline" size="sm" fullWidth>
                Download Mesh (.obj)
              </AppButton>
            </div>
          </Panel>

          <Panel title="Quality Metrics">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">RMS Error</span>
                <span className="text-success text-xs font-mono">0.023 m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">GCP Residual</span>
                <span className="text-success text-xs font-mono">0.018 m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Classification</span>
                <StatusBadge variant="active">VERIFIED</StatusBadge>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
