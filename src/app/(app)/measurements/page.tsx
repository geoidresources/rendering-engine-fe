"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import DataTable from "@/components/ui/DataTable";
import MetricCard from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMeasurementInventory } from "@/hooks/useMeasurements";
import { useProjects } from "@/hooks/useProjects";
import { useSurveys } from "@/hooks/useSurveys";
import { toCSV, downloadCSV, type MeasurementRow } from "@/lib/export/csvExport";
import type { MeasurementInventoryItem } from "@/types/api";

// Lazy-load so Cesium JS stays out of the initial /measurements bundle.
const StockpileMeshPreview = dynamic(
  () => import("@/components/measurements/StockpileMeshPreview"),
  { ssr: false },
);

function formatNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Compact form for KPI tiles where 7+ digit numbers overflow the card.
// Mirrors /home's "3.96Mt" convention so the top-of-page metrics stay
// readable at 4-up grid density. No space between number and suffix —
// the suffix is part of the number, not a unit.
function formatCompact(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${Math.round(n / 1e3)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function MeasurementsPage() {
  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id ?? "";
  const { data: surveys, isLoading: loadingSurveys } = useSurveys(projectId);
  const surveyId = surveys?.[0]?.id ?? "";

  const { data: inventory, isLoading } = useMeasurementInventory(projectId, surveyId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Gate the whole page on data-presence so we never show a skeleton that
  // never resolves. The auto-select that seeds surveyId can't fire if the
  // project has no surveys yet — without an empty-state we'd spin forever.
  const hasProjects = !!projects?.length;
  const hasSurveys = !loadingSurveys && !!surveys?.length;
  const hasInventory = !!inventory && inventory.items.length > 0;
  const hasInventoryData = hasInventory && inventory!.items.some((i) => i.volume_m3 != null);

  // Auto-select the first pile with a real volume so the preview is
  // never blank on load. Falls back to the very first row if nothing
  // has volume data yet.
  const selectedItem = useMemo<MeasurementInventoryItem | null>(() => {
    const items = inventory?.items ?? [];
    if (!items.length) return null;
    if (selectedId) {
      const hit = items.find((i) => i.id === selectedId);
      if (hit) return hit;
    }
    return items.find((i) => i.volume_m3 != null) ?? items[0] ?? null;
  }, [inventory, selectedId]);

  const columns = [
    { key: "name", label: "Name" },
    {
      key: "feature_type",
      label: "Type",
      render: (val: unknown) => <Badge variant="tag">{(val as string).replace(/_/g, " ").toUpperCase()}</Badge>,
    },
    {
      key: "material_type",
      label: "Material",
      render: (val: unknown) => <span className="text-foreground/80 text-xs font-mono">{(val as string | null) ?? "—"}</span>,
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
        return <Badge variant={locked ? "standby" : "active"}>{locked ? "LOCKED" : "ACTIVE"}</Badge>;
      },
    },
  ];

  // Show `—` (em-dash) — not `0` — when no stockpile-inventory processor has
  // produced analytics rows yet. A real-data zero means "we measured, there
  // was nothing"; a fresh-ingest zero means "we haven't measured yet". They
  // read identically in the UI otherwise, which is the bug operators flagged
  // as "data not wired properly".
  const stats = hasInventoryData
    ? [
      { title: "Total Inventory", value: `${formatCompact(inventory!.total_volume_m3)} m³`, subtitle: `${formatCompact(inventory!.total_tonnage)} t` },
      { title: "Measured Area", value: `${formatCompact(inventory!.total_area_m2)} m²`, subtitle: "Total coverage" },
      { title: "Stockpiles", value: String(inventory!.stockpile_count), subtitle: "With volume data" },
      { title: "Total Features", value: String(inventory!.items.length), subtitle: "All measurement types" },
    ]
    : [
      { title: "Total Inventory", value: "—", subtitle: "Awaiting analytics" },
      { title: "Measured Area", value: "—", subtitle: "Awaiting analytics" },
      { title: "Stockpiles", value: "—", subtitle: "Awaiting analytics" },
      { title: "Total Features", value: "—", subtitle: "Awaiting analytics" },
    ];

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold uppercase tracking-wider">
            Volumetric <span className="text-accent">Inventory</span>
          </h1>
          <p className="text-muted-foreground text-xs uppercase tracking-wider font-mono mt-1">
            {isLoading ? "Loading measurement data..." : `${inventory?.items.length ?? 0} measurements across ${inventory?.stockpile_count ?? 0} stockpiles`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
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
            }}
          >
            Export CSV
          </Button>
          <Button variant="outline" size="sm">Filters</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <MetricCard key={stat.title} {...stat} />
        ))}
      </div>

      {hasProjects && !hasSurveys ? (
        <Card className="rounded-sm ring-0 gap-0 py-0">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <h3 className="text-foreground text-lg font-bold uppercase tracking-wider">No survey ingested yet</h3>
            <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider max-w-md">
              Stockpile inventory appears once the first survey has been uploaded and processed.
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
      <div className="grid grid-cols-12 gap-4">
        <div className={hasInventoryData ? "col-span-8" : "col-span-12"}>
          <Card className="rounded-sm ring-0 gap-0 py-0 overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground text-xs">Loading inventory...</div>
              ) : (
                <DataTable
                  columns={columns}
                  data={(inventory?.items ?? [])
                    .filter((item) => item.volume_m3 != null)
                    .sort((a, b) => (b.volume_m3 ?? 0) - (a.volume_m3 ?? 0)) as unknown as Record<string, unknown>[]}
                  onRowClick={(row) => setSelectedId((row as unknown as MeasurementInventoryItem).id)}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Point Cloud Inspector — right sidebar. Hidden entirely when no
            pile has volume data; the left column stretches full-width. */}
        {hasInventoryData && (
        <div className="col-span-4 flex flex-col gap-4">
          <Card className="rounded-sm ring-0 gap-0 py-0 overflow-hidden">
            <div className="px-4 py-3 border-b">
              <span className="text-destructive text-[10px] uppercase tracking-wider font-medium">Point Cloud</span>
              <h3 className="text-foreground text-sm font-bold uppercase tracking-wider mt-1">
                Inspector
              </h3>
            </div>
            {/* Live 3D extruded-polygon preview of the selected pile.
                Height = volume / area (the volumetric mean); footprint
                is the real polygon from measurements.geom. */}
            <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
              {selectedItem ? (
                <StockpileMeshPreview item={selectedItem} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-mono">
                    Select a stockpile
                  </span>
                </div>
              )}
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Footprint</span>
                <span className="text-foreground/80 text-xs font-mono">
                  {selectedItem?.area_m2 != null ? `${formatNum(selectedItem.area_m2)} m²` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Mean height</span>
                <span className="text-foreground/80 text-xs font-mono">
                  {selectedItem?.volume_m3 != null &&
                    selectedItem?.area_m2 != null &&
                    selectedItem.area_m2 > 0
                    ? `${formatNum(selectedItem.volume_m3 / selectedItem.area_m2)} m`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Volume</span>
                <span className="text-foreground/80 text-xs font-mono">
                  {selectedItem?.volume_m3 != null ? `${formatNum(selectedItem.volume_m3)} m³` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Tonnage</span>
                <span className="text-foreground/80 text-xs font-mono">
                  {selectedItem?.tonnage != null ? `${formatNum(selectedItem.tonnage)} t` : "—"}
                </span>
              </div>
            </div>
          </Card>

          {(() => {
            const activeSurvey = surveys?.find((s) => s.id === surveyId);
            const metadata = activeSurvey?.metadata as Record<string, any> | null;
            const rms = metadata?.rms_error_m;
            const gcp = metadata?.gcp_residual_m;
            const classification = metadata?.classification ?? activeSurvey?.status;

            if (!rms && !gcp && !classification) return null;

            return (
              <Card className="rounded-sm ring-0 gap-0 py-0">
                <CardHeader className="px-6 py-3 border-b">
                  <CardTitle className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                    Quality Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    {rms != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">RMS Error</span>
                        <span className="text-success text-xs font-mono">{rms.toFixed(3)} m</span>
                      </div>
                    )}
                    {gcp != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">GCP Residual</span>
                        <span className="text-success text-xs font-mono">{gcp.toFixed(3)} m</span>
                      </div>
                    )}
                    {classification && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Classification</span>
                        <Badge variant="active">{String(classification).toUpperCase()}</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
        )}
      </div>
      )}
    </div>
  );
}
