'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  Bookmark,
  Columns2,
  Eye,
  EyeOff,
  Layers3,
  LayoutDashboard,
  Loader2,
  MapPinned,
  MoveHorizontal,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Ruler,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { Viewer as CesiumViewer } from 'cesium';

import { useViewerStore, type LayerId, type RightRailTab } from '@/store/viewerStore';
import { useCompareStore } from '@/store/compareStore';
import { useSiteStore } from '@/store/siteStore';
import { useCutFill } from '@/hooks/useCutFill';
import { useMaterials } from '@/hooks/useMaterials';
import { useMeasurementsList, useDeleteMeasurement, useRecomputeMeasurement, type MeasurementResponse, type QAStatus } from '@/hooks/useMeasurementsCrud';
import { DesignOverlayUploader } from '@/components/viewer/DesignOverlayUploader';
import { RegionAlertTooltip } from '@/components/viewer/RegionAlertTooltip';
import { BookmarksPanel } from '@/components/viewer/BookmarksPanel';
import { useViewerThresholdAlerts } from '@/hooks/useViewerThresholdAlerts';
import { exportMeasurementAsGeoJson } from '@/lib/export/geojsonExport';
import { exportMeasurementAsCsv, type MeasurementRow } from '@/lib/export/csvExport';
import {
  exportMeasurementVector,
  downloadMeasurementGeoTiff,
  type VectorExportFormat,
  type RasterExportSource,
} from '@/lib/export/vectorExport';
import { apiClient, unwrapList } from '@/lib/http';
import type { ListEnvelope } from '@/types/api';
import StatusChip, { type StatusTone } from '@/components/ui/StatusChip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EmptyStateNudge } from './EmptyStateNudge';
import { MeasurementResultsCard } from './MeasurementResultsCard';

const SITE_DISTRIBUTION_PALETTE = ['#F59E0B', '#FBBF24', '#FCD34D', '#A78BFA', '#60A5FA', '#FB7185'];

interface RightRailProps {
  /** Active survey id — drives stockpiles + heatmap analytics. */
  surveyId?: string;
  /** Active project id — drives anomaly trends. */
  projectId?: string;
  /** Live Cesium viewer ref. Threaded down so the InspectorTab's
   *  `<MeasurementResultsCard />` can call `recomputeVolume(viewer, …)`
   *  when the operator picks a different base plane — none of the
   *  other tabs need it, but threading the ref keeps the data flow
   *  explicit (instead of a global viewer registry). */
  viewerRef?: React.RefObject<CesiumViewer | null>;
}

interface TabDef {
  id: RightRailTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortcut: '1' },
  { id: 'layers', label: 'Layers', icon: Layers3, shortcut: '2' },
  { id: 'inspector', label: 'Inspector', icon: MapPinned, shortcut: '3' },
  // Labelled "Saved regions" — *not* "Measurements" — to defuse the
  // collision with live measurement readouts. Live values live in the
  // Inspector tab while drawing; this tab is the persistent server-side
  // catalogue of finished regions/polygons. Icon stays `Ruler` since the
  // tab still represents geometric features; revisit if it confuses.
  { id: 'measurements', label: 'Saved regions', icon: Ruler, shortcut: '4' },
  { id: 'compare', label: 'Compare', icon: Columns2, shortcut: '5' },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, shortcut: '6' },
];

/**
 * Single right-side rail (≈360 px) that replaces the 5 stacked floating
 * panels (SiteDistribution, AnomalyAlerts, ZoneAnalyticsPanel,
 * InspectorPanel, LayerPanel). Five tabs share one surface; the active
 * tab follows context — see `revealRailFor` in viewerStore.
 *
 * Tabs ranked by canvas-priority left → right; the rail itself collapses
 * to a 36 px tab strip via `setRightRailCollapsed` so the canvas can
 * occupy the full viewport when needed.
 */
export const RightRail: React.FC<RightRailProps> = ({ surveyId, projectId, viewerRef }) => {
  const tab = useViewerStore((s) => s.rightRailTab);
  const collapsed = useViewerStore((s) => s.rightRailCollapsed);
  const setTab = useViewerStore((s) => s.setRightRailTab);
  const setCollapsed = useViewerStore((s) => s.setRightRailCollapsed);

  return (
    <aside
      role="complementary"
      aria-label="Site context rail"
      className={cn(
        // ≥lg: vertical rail on the right side (unchanged behaviour).
        'lg:shrink-0 lg:h-full lg:flex lg:border-l lg:border-t-0',
        'lg:border-border-subtle lg:bg-bg-surface/85 lg:backdrop-blur-md',
        'lg:supports-[backdrop-filter]:bg-bg-surface/65',
        collapsed ? 'lg:w-9' : 'lg:w-[360px]',
        // <lg: fixed bottom sheet.
        'fixed bottom-0 left-0 right-0 flex flex-col rounded-t-xl border-t border-border-subtle',
        'bg-bg-surface/95 backdrop-blur-md shadow-2xl z-30',
        'lg:relative lg:rounded-none lg:flex-row',
        collapsed ? 'max-h-10' : 'max-h-[60dvh]',
      )}
    >
      {/* Vertical tab strip — always visible; doubles as collapse handle */}
      <div
        role="tablist"
        aria-orientation="vertical"
        className={cn(
          'flex shrink-0 items-center gap-1 bg-bg-base/60',
          // Horizontal strip on mobile, vertical strip on lg+.
          'flex-row w-full border-b border-border-subtle px-2 py-1.5',
          'lg:flex-col lg:w-9 lg:h-full lg:border-r lg:border-b-0 lg:py-2 lg:px-0',
        )}
      >
        {TABS.map(({ id, label, icon: Icon, shortcut }) => {
          const active = !collapsed && tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${label} (key ${shortcut})`}
              title={`${label} · ${shortcut}`}
              onClick={() => {
                if (collapsed) {
                  setTab(id);
                } else if (tab === id) {
                  setCollapsed(true);
                } else {
                  setTab(id);
                }
              }}
              className={cn(
                'h-10 w-10 lg:h-9 lg:w-7 grid place-items-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated',
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          type="button"
          aria-label={collapsed ? 'Expand rail' : 'Collapse rail'}
          title={collapsed ? 'Expand rail' : 'Collapse rail'}
          onClick={() => setCollapsed(!collapsed)}
          className="h-10 w-10 lg:h-9 lg:w-7 grid place-items-center rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
        >
          {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
        </button>
      </div>

      {/* Active tab body */}
      {!collapsed && (
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
            <div className="min-w-0">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-primary truncate">
                {TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-[10px] font-mono text-text-muted truncate">
                Press <kbd className="font-mono">{TABS.find((t) => t.id === tab)?.shortcut}</kbd> to focus
              </p>
            </div>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === 'overview' && (
              <OverviewTab surveyId={surveyId} projectId={projectId} />
            )}
            {tab === 'layers' && <LayersTab />}
            {tab === 'inspector' && (
              <InspectorTab projectId={projectId} viewerRef={viewerRef} />
            )}
            {tab === 'measurements' && <SavedRegionsTab projectId={projectId} />}
            {tab === 'compare' && <CompareTab />}
            {tab === 'bookmarks' && <BookmarksPanel surveyId={surveyId} />}
          </div>
        </div>
      )}
    </aside>
  );
};

/* ───────────────────────── Overview ───────────────────────── */

interface AnomalyRow {
  id: string;
  material: string;
  severity: string;
  message: string;
}

interface DistribRow {
  label: string;
  value: number;
  color: string;
}

const SEVERITY_TONE: Record<string, { tone: StatusTone; label: string }> = {
  alert: { tone: 'danger', label: 'ALERT' },
  critical: { tone: 'danger', label: 'CRITICAL' },
  pending: { tone: 'processing', label: 'PENDING' },
  warning: { tone: 'warning', label: 'WARNING' },
  ok: { tone: 'success', label: 'OK' },
};

const OverviewTab: React.FC<{ surveyId?: string; projectId?: string }> = ({
  surveyId,
  projectId,
}) => {
  // Anomaly chips are sourced from `/api/v1/analytics/trends`, which the
  // backend strictly scopes to a single material per call (see
  // `rendering-engine-be/internal/handlers/handlers.go:387` — empty
  // `material` returns 400). We therefore fetch the project's recent
  // material list, fan out one trends query per material, then aggregate.
  // Capped to 5 because (a) the chip row only shows 5 chips and (b) the
  // demo project has ~400 `auto_pile_X` "materials" that would otherwise
  // detonate a request storm.
  type TrendRow = {
    material: string;
    is_anomaly: boolean;
    anomaly_severity: string;
    anomaly_z_score: number;
  };

  const { data: materialsList, isLoading: materialsLoading } =
    useMaterials(projectId);
  // Defensive: `useMaterials` already coerces to an array, but the queryKey
  // is shared with `useHomeDashboard`'s envelope-shaped cache, so a stale
  // entry could still flow through here. Guard before `.slice` to keep this
  // tab from crashing the whole rail.
  const materialsToQuery = Array.isArray(materialsList)
    ? materialsList.slice(0, 5).map((m) => m.material)
    : [];

  const { anomalies, isLoading: trendsLoading } = useQueries({
    queries: materialsToQuery.map((material) => ({
      queryKey: ['rail-anomalies', projectId, material] as const,
      enabled: !!projectId && !!material,
      queryFn: async () => {
        const res = await apiClient.get<ListEnvelope<TrendRow>>(
          `/api/v1/analytics/trends?project_id=${projectId}&material=${encodeURIComponent(material)}`,
        );
        return unwrapList<TrendRow>(res.data);
      },
    })),
    // `combine` runs once per render with the latest result snapshots,
    // so the returned object is stable across re-renders that don't
    // touch any per-material query — avoids the useMemo-on-array-of-
    // query-results gotcha (each result is a fresh object).
    combine: (results) => {
      const rows = results.flatMap((r) => r.data ?? []);
      const sorted = rows
        .filter((t) => t.is_anomaly)
        .sort(
          (a, b) =>
            Math.abs(b.anomaly_z_score ?? 0) -
            Math.abs(a.anomaly_z_score ?? 0),
        )
        .slice(0, 5)
        .map<AnomalyRow>((t, i) => ({
          id: `a-${i}`,
          material: t.material,
          severity: t.anomaly_severity ?? 'warning',
          message: `z = ${t.anomaly_z_score?.toFixed(2) ?? '—'}`,
        }));
      return {
        anomalies: sorted,
        isLoading: results.some((r) => r.isLoading),
      };
    },
  });

  const anomaliesLoading = materialsLoading || trendsLoading;

  const { data: distrib = [], isLoading: distribLoading } = useQuery<DistribRow[]>({
    queryKey: ['rail-stockpiles', surveyId],
    enabled: !!surveyId,
    queryFn: async () => {
      type StockpileRow = { material_type: string; volume_m3: number };
      const res = await apiClient.get<ListEnvelope<StockpileRow>>(
        `/api/v1/analytics/stockpiles?survey_id=${surveyId}`,
      );
      const rows = unwrapList<StockpileRow>(res.data);
      const grouped = rows.reduce<Record<string, number>>((acc, row) => {
        const k = row.material_type || 'Unknown';
        acc[k] = (acc[k] ?? 0) + (row.volume_m3 ?? 0);
        return acc;
      }, {});
      return Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value], i) => ({
          label,
          value: Math.round(value),
          color: SITE_DISTRIBUTION_PALETTE[i % SITE_DISTRIBUTION_PALETTE.length],
        }));
    },
  });

  const totalVolume = useMemo(
    () => distrib.reduce((acc, d) => acc + d.value, 0),
    [distrib],
  );

  if (!surveyId) {
    return (
      <EmptyStateNudge
        icon={<LayoutDashboard className="size-8" />}
        title="No survey selected"
        hint="Pick a site and epoch in the top bar to load analytics."
      />
    );
  }

  return (
    <div className="px-3 py-3 space-y-4">
      {/* KPIs */}
      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-2">
          Volume
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <KpiCell
            label="Total volume"
            value={
              distribLoading
                ? '—'
                : totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })
            }
            unit="m³"
          />
          <KpiCell
            label="Stockpiles"
            value={distribLoading ? '—' : String(distrib.length)}
          />
        </div>
      </section>

      {/* Distribution bars */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Top materials by volume
          </h3>
          {distribLoading && <Loader2 className="size-3 text-accent animate-spin" />}
        </div>
        {distrib.length === 0 && !distribLoading ? (
          <p className="text-[11px] text-text-muted leading-snug">
            No stockpile analytics for this survey yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {distrib.map((row) => {
              const pct = totalVolume > 0 ? Math.round((row.value / totalVolume) * 100) : 0;
              return (
                <li key={row.label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-text-primary truncate">{row.label}</span>
                    <span
                      className="text-[10px] font-mono text-text-muted"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {row.value.toLocaleString()} m³
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-base overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: row.color }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Anomalies */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted flex items-center gap-1.5">
            <AlertTriangle className="size-3" />
            Anomalies
          </h3>
          {anomaliesLoading && <Loader2 className="size-3 text-accent animate-spin" />}
        </div>
        {anomalies.length === 0 && !anomaliesLoading ? (
          <p className="text-[11px] text-text-muted leading-snug">
            No active anomalies detected.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {anomalies.map((a) => {
              const sev = SEVERITY_TONE[a.severity.toLowerCase()] ?? {
                tone: 'info' as StatusTone,
                label: 'INFO',
              };
              return (
                <li
                  key={a.id}
                  className="rounded-sm border border-border-subtle bg-bg-base/50 px-2 py-1.5 flex items-center gap-2"
                >
                  <StatusChip tone={sev.tone} dot={false}>
                    {sev.label}
                  </StatusChip>
                  <span className="text-[11px] text-text-primary font-mono truncate flex-1">
                    {a.material}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">{a.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

const KpiCell: React.FC<{ label: string; value: string; unit?: string }> = ({
  label,
  value,
  unit,
}) => (
  <div className="rounded-sm border border-border-subtle bg-bg-base/60 px-2.5 py-2">
    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-text-muted">
      {label}
    </p>
    <p
      className="mt-0.5 font-mono text-sm text-text-primary"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {value}
      {unit && <span className="text-[10px] text-text-muted ml-1">{unit}</span>}
    </p>
  </div>
);

/* ───────────────────────── Layers ───────────────────────── */

const LayersTab: React.FC = () => {
  const layers = useViewerStore((s) => s.layers);
  const setLayerVisibility = useViewerStore((s) => s.setLayerVisibility);
  const setLayerOpacity = useViewerStore((s) => s.setLayerOpacity);
  const blendPreset = useViewerStore((s) => s.blendPreset);
  const setBlendPreset = useViewerStore((s) => s.setBlendPreset);
  const activePresetId = useViewerStore((s) => s.activePresetId);
  // Terrain mode is a sub-setting of the Terrain layer — Cesium can only
  // attach one terrain provider at a time, so DTM and DSM are mutually
  // exclusive flavours of the same surface. Lives here (not on the
  // toolbar) because it's a layer choice, not an action.
  const terrainMode = useViewerStore((s) => s.terrainMode);
  const setTerrainMode = useViewerStore((s) => s.setTerrainMode);

  const presetActive = activePresetId !== null;

  // Raw primitives (blend + per-layer opacity) wrapped in an Advanced accordion
  // when a workspace preset is active. Visibility toggles always stay visible.
  const rawControls = (
    <>
      <div className="rounded-sm border border-border-subtle bg-bg-base/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-primary">
              Blend
            </h3>
            <p className="text-[10px] text-text-muted leading-snug mt-0.5">
              Stack vs. integrated look.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Layer blend preset"
            className="inline-flex rounded-sm border border-border-subtle bg-bg-surface p-0.5"
          >
            {(['stacked', 'embedded'] as const).map((preset) => {
              const active = blendPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setBlendPreset(preset)}
                  className={
                    active
                      ? 'rounded-sm px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] bg-accent text-[#111]'
                      : 'rounded-sm px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                  }
                >
                  {preset === 'stacked' ? 'Stacked' : 'Embedded'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {(Object.keys(layers) as LayerId[]).map((id) => {
        const layer = layers[id];
        const opacityLocked = !layer.visible;
        const isTerrain = id === 'dsm';
        return (
          <div
            key={id}
            className="rounded-sm border border-border-subtle bg-bg-base/60 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[12px] text-text-primary">
                {layer.name}
              </span>
              <button
                type="button"
                onClick={() => setLayerVisibility(id, !layer.visible)}
                title={`Toggle visibility for ${layer.name}`}
                aria-label={`Toggle visibility for ${layer.name}`}
                className="text-text-muted hover:text-accent transition-colors"
              >
                {layer.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>

            {/* Terrain-only sub-control: DTM (bare earth) ↔ DSM (surface).
                Mirrors the Blend segmented control above so the visual
                language for "pick one of two" is consistent across the
                tab. Disabled when the terrain layer itself is hidden —
                no point picking a flavour of an invisible layer. */}
            {isTerrain && (
              <div
                className={cn(
                  'mb-2 flex items-center justify-between gap-3',
                  opacityLocked && 'pointer-events-none opacity-55',
                )}
              >
                <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted">
                  Mode
                </span>
                <div
                  role="tablist"
                  aria-label="Terrain mode"
                  className="inline-flex rounded-sm border border-border-subtle bg-bg-surface p-0.5"
                >
                  {(['dtm', 'dsm'] as const).map((m) => {
                    const active = terrainMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTerrainMode(m)}
                        title={
                          m === 'dtm'
                            ? 'Bare-earth terrain — analytics surface (volumes, cut/fill)'
                            : 'Surface terrain — includes structures and vegetation'
                        }
                        className={
                          active
                            ? 'rounded-sm px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] bg-accent text-[#111]'
                            : 'rounded-sm px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                        }
                      >
                        {m === 'dtm' ? 'DTM' : 'DSM'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {layer.error && (
              <p className="text-[11px] text-red-400 mb-2 leading-snug" role="alert">
                {layer.error}
              </p>
            )}

            <div
              className={
                opacityLocked
                  ? 'pointer-events-none select-none opacity-55 rounded-sm'
                  : ''
              }
              title={
                opacityLocked
                  ? 'Turn this layer on to change opacity.'
                  : 'Drag to change layer opacity.'
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted w-12">
                  Opacity
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={layer.opacity}
                  disabled={opacityLocked}
                  onChange={(e) => setLayerOpacity(id, parseFloat(e.target.value))}
                  aria-label={`Opacity for ${layer.name}`}
                  className="flex-1 h-1.5 bg-bg-elevated rounded-sm appearance-none cursor-pointer accent-accent disabled:cursor-not-allowed"
                />
                <span
                  className="text-[10px] font-mono text-text-muted w-10 text-right"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );

  return (
    <div className="px-3 py-3 space-y-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted leading-snug">
        Toggle visibility and opacity per layer. Choose bare-earth (DTM) or
        surface (DSM) for terrain.
      </p>

      {presetActive ? (
        <details className="group rounded-sm border border-border-subtle bg-bg-base/60">
          <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-text-muted hover:text-text-primary list-none">
            <span className="font-semibold">Advanced</span>
            <svg
              className="size-3 rotate-0 transition-transform group-open:rotate-90"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 2l4 4-4 4" />
            </svg>
          </summary>
          <div className="px-3 pb-3 space-y-3 opacity-80">
            {rawControls}
          </div>
        </details>
      ) : (
        rawControls
      )}

      {/* V-TASK-03: design overlay upload */}
      <div className="pt-1">
        <p className="text-[9px] uppercase tracking-[0.15em] text-text-muted mb-1.5">Design overlay</p>
        <DesignOverlayUploader />
      </div>
    </div>
  );
};

/* ───────────────────────── Inspector ───────────────────────── */

interface InspectorTabProps {
  projectId?: string;
  viewerRef?: React.RefObject<CesiumViewer | null>;
}

const InspectorTab: React.FC<InspectorTabProps> = ({ projectId, viewerRef }) => {
  const selectedFeature = useViewerStore((s) => s.selectedFeature);
  const selectedAreaDetails = useViewerStore((s) => s.selectedAreaDetails);
  const areaDetailsLoading = useViewerStore((s) => s.areaDetailsLoading);
  const activeTool = useViewerStore((s) => s.activeTool);
  const profile = useViewerStore((s) => s.profile);
  const setSelectedFeature = useViewerStore((s) => s.setSelectedFeature);
  const setSelectedAreaDetails = useViewerStore((s) => s.setSelectedAreaDetails);

  const isMeasuring =
    activeTool === 'distance' || activeTool === 'area' || activeTool === 'volume';
  // Profile/cross-section results live on the bottom dock but the card
  // also surfaces a slope-KPI summary; we want the empty-state nudge to
  // bow out as soon as either path is active.
  const hasProfile = profile.samples !== null && profile.samples.length >= 2;

  if (
    !isMeasuring &&
    !hasProfile &&
    !selectedFeature &&
    !selectedAreaDetails &&
    !areaDetailsLoading
  ) {
    return (
      <EmptyStateNudge
        icon={<MapPinned className="size-8" />}
        title="Pick something on the canvas"
        hint="With Select active, click a polygon, 3D Tile feature, or the site model to inspect properties."
      />
    );
  }

  // Build a no-op viewerRef for the rare case the parent didn't pass one
  // (e.g. unit/storybook mounts). The card guards `viewer.current ===
  // null`, so a stable null-ref is enough — `recomputeVolume` simply
  // bails when the viewer isn't there.
  const safeViewerRef =
    viewerRef ?? ({ current: null } as React.RefObject<CesiumViewer | null>);

  return (
    <div
      className="px-3 py-3 space-y-3 text-[11px] text-text-primary"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {(isMeasuring || hasProfile) && (
        <MeasurementResultsCard
          projectId={projectId ?? null}
          viewerRef={safeViewerRef}
        />
      )}

      {selectedFeature && (
        <div className="rounded-sm border border-border-subtle bg-bg-base/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">
                Selected feature
              </p>
              <h4 className="text-[12px] font-semibold text-text-primary">
                {String(selectedFeature.name ?? selectedFeature.id ?? 'Unnamed feature')}
              </h4>
            </div>
            <StatusChip tone="info" dot={false}>
              {String(selectedFeature._source ?? 'feature')}
            </StatusChip>
          </div>
          <p className="text-[10px] font-mono text-text-muted">
            id: {String(selectedFeature.id ?? selectedFeature._entityId ?? 'n/a')}
          </p>
        </div>
      )}

      {(areaDetailsLoading || selectedAreaDetails) && (
        <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">
                Area details
              </p>
              <h4 className="text-[12px] font-semibold text-emerald-100">
                {selectedAreaDetails?.name ?? 'Loading area details'}
              </h4>
            </div>
            {areaDetailsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
            )}
          </div>

          {selectedAreaDetails && (
            <div className="grid grid-cols-2 gap-2">
              <DetailCell label="Material" value={selectedAreaDetails.material} />
              <DetailCell label="Status" value={selectedAreaDetails.status} />
              <DetailCell
                label="Area"
                value={formatArea(selectedAreaDetails.areaSquareMeters)}
              />
              <DetailCell
                label="Perimeter"
                value={formatDistance(selectedAreaDetails.perimeterMeters)}
              />
              <DetailCell
                label="Avg elevation"
                value={`${selectedAreaDetails.averageElevationMeters.toFixed(1)} m`}
              />
              <DetailCell label="Last surveyed" value={selectedAreaDetails.lastSurveyedAt} />
            </div>
          )}
        </div>
      )}

      {selectedFeature && <FeaturePropertiesTable feature={selectedFeature} />}

      {(selectedFeature || selectedAreaDetails) && (
        <button
          type="button"
          onClick={() => {
            setSelectedFeature(null);
            setSelectedAreaDetails(null);
          }}
          className="text-[10px] uppercase tracking-[0.15em] text-text-muted hover:text-text-primary transition-colors"
        >
          Clear selection
        </button>
      )}
    </div>
  );
};

const DetailCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-sm bg-bg-surface/60 p-2 border border-emerald-500/20">
    <p className="text-emerald-200/70 text-[10px] uppercase tracking-[0.15em]">{label}</p>
    <p className="font-semibold text-emerald-50">{value}</p>
  </div>
);

/* Pretty-printed property table for the Inspector — replaces the raw
 * JSON dump. Skips noisy internal keys (prefixed with `_`), formats
 * numbers with tabular-nums, and renders nested objects as nested
 * key/value blocks one level deep before falling back to JSON for the
 * rare deeply-nested case. */
const FeaturePropertiesTable: React.FC<{ feature: Record<string, unknown> }> = ({ feature }) => {
  const rows = useMemo(() => {
    return Object.entries(feature)
      .filter(([k]) => !k.startsWith('_') && k !== 'id' && k !== 'name')
      .sort(([a], [b]) => a.localeCompare(b));
  }, [feature]);

  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-text-muted italic">
        No additional properties on this feature.
      </p>
    );
  }

  return (
    <div className="rounded-sm border border-border-subtle bg-bg-base/60 overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-border-subtle bg-bg-elevated/40">
        <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted">
          Properties
        </p>
      </div>
      <dl className="divide-y divide-border-subtle">
        {rows.map(([key, val]) => (
          <div key={key} className="grid grid-cols-[100px_1fr] gap-2 px-2.5 py-1.5">
            <dt className="text-[10px] uppercase tracking-[0.1em] text-text-muted truncate" title={key}>
              {key}
            </dt>
            <dd
              className="text-[11px] font-mono text-text-primary break-words"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatPropertyValue(val)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

function formatPropertyValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return String(val);
    return Math.abs(val) >= 1000 || Number.isInteger(val)
      ? val.toLocaleString()
      : val.toFixed(3);
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

/* ───────────────────────── Saved regions ───────────────────────── */

const QA_PILL_STYLES: Record<QAStatus, string> = {
  approved: 'bg-green-500/15 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function QAStatusPill({ status }: { status: QAStatus }) {
  return (
    <span
      className={cn(
        'shrink-0 inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] leading-none',
        QA_PILL_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

// Tab content for the right rail's "Saved regions" tab. Reads the
// backend-persisted measurement / drawn-region catalogue via
// `useMeasurementsList` — these are durable, server-side features, not
// the live in-progress canvas measurement which lives in viewerStore
// and is rendered by InspectorTab + MeasurementLiveReadout.
type SavedRegionsSortKey = 'recent' | 'name' | 'material';

/** Filesystem-safe slug for filename fragments: lowercase, non-alphanumerics
 *  collapsed to `-`, trimmed, capped so a long region name doesn't blow out
 *  the OS name limit. Shared by the V-OUTPUT-02 export menu. */
function slugifyForFilename(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return cleaned.length ? cleaned.slice(0, 64) : 'untitled';
}

/** Map an asset-svc `MeasurementResponse` onto the shared `MeasurementRow`
 *  CSV schema. Volume / area / tonnage live under `properties` on the
 *  server record; we surface what's there and leave the rest null so the
 *  columns stay stable. */
function measurementToCsvRow(row: MeasurementResponse): MeasurementRow {
  const props = row.properties ?? {};
  const asNumber = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const geom = row.geojson as { coordinates?: unknown } | undefined;
  return {
    id: row.id,
    type: row.feature_type,
    name: row.name,
    project_id: row.project_id,
    survey_id: row.latest_survey_id ?? '',
    coordinates: geom?.coordinates ? JSON.stringify(geom.coordinates) : '',
    distance_m: asNumber(props.distance_m),
    area_m2: asNumber(props.area_m2),
    volume_m3: asNumber(props.volume_m3),
    created_at: row.created_at,
  };
}

const SavedRegionsTab: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { data: rows = [], isLoading, error } = useMeasurementsList(projectId);
  const flyTo = useViewerStore((s) => s.flyTo);
  const deleteMutation = useDeleteMeasurement(projectId);
  const recomputeMutation = useRecomputeMeasurement(projectId);
  const breaches = useViewerThresholdAlerts(projectId);
  const recentSites = useSiteStore((s) => s.recentSites);
  const projectName = recentSites.find((s) => s.projectId === projectId)?.name;
  const projectSlug = slugifyForFilename(projectName ?? 'geoid');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SavedRegionsSortKey>('recent');

  if (!projectId) {
    return (
      <EmptyStateNudge
        icon={<Pencil className="size-8" />}
        title="No project loaded"
        hint="Open a survey first — drawn regions and saved measurements will appear here."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-4 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-3 text-[11px] text-red-400">
        Could not load saved regions: {error.message}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyStateNudge
        icon={<Pencil className="size-8" />}
        title="No drawn regions yet"
        hint="Press D to draw a polygon region — it will save as a stockpile feature on this project."
      />
    );
  }

  // Centroid of a GeoJSON Polygon ring — naïve average of coords.
  const centroid = (row: { geojson?: Record<string, unknown> }): { lng: number; lat: number } | null => {
    const geom = row.geojson as
      | { type?: string; coordinates?: [number, number][][] }
      | undefined;
    if (!geom || geom.type !== 'Polygon' || !geom.coordinates?.[0]?.length) return null;
    const ring = geom.coordinates[0];
    const sum = ring.reduce(
      (acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }),
      { lng: 0, lat: 0 },
    );
    return { lng: sum.lng / ring.length, lat: sum.lat / ring.length };
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => {
        const material = String(r.properties?.material ?? r.feature_type ?? '');
        return (
          r.name.toLowerCase().includes(q) ||
          material.toLowerCase().includes(q)
        );
      })
    : rows;

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'material') {
      const ma = String(a.properties?.material ?? a.feature_type ?? '');
      const mb = String(b.properties?.material ?? b.feature_type ?? '');
      return ma.localeCompare(mb);
    }
    // recent: newest first by created_at (ISO strings sort lexicographically)
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });

  return (
    <div className="px-2 py-2 space-y-1">
      <div className="px-1 pb-1 space-y-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search regions…"
            aria-label="Search saved regions"
            className="w-full rounded-sm border border-border-subtle bg-bg-elevated pl-7 pr-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/60"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] uppercase tracking-[0.15em] text-text-muted">
            {sorted.length} of {rows.length}
          </span>
          <div role="group" aria-label="Sort regions" className="inline-flex items-center rounded-sm border border-border-subtle p-0.5">
            {([
              { id: 'recent', label: 'Recent' },
              { id: 'name', label: 'A–Z' },
              { id: 'material', label: 'Material' },
            ] as { id: SavedRegionsSortKey; label: string }[]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortKey(opt.id)}
                aria-pressed={sortKey === opt.id}
                className={cn(
                  'h-5 px-1.5 rounded-sm text-[9px] uppercase tracking-[0.12em] transition-colors',
                  sortKey === opt.id ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {sorted.length === 0 && (
        <p className="px-2 py-3 text-[11px] text-text-muted text-center">
          No regions match “{query}”.
        </p>
      )}
      {sorted.map((row) => {
        const c = centroid(row);
        const material = (row.properties?.material as string | undefined) ?? row.feature_type;
        const dateStamp = (row.updated_at ?? row.created_at ?? new Date().toISOString()).slice(0, 10);
        const baseName = `${projectSlug}_${slugifyForFilename(row.name)}_${dateStamp}`;
        const onExportGeoJson = () => {
          exportMeasurementAsGeoJson(
            {
              id: row.id,
              name: row.name,
              feature_type: row.feature_type,
              geojson: row.geojson,
              properties: row.properties ?? null,
              is_locked: row.is_locked,
              created_at: row.created_at,
              updated_at: row.updated_at,
              material_type: (row.properties?.material as string | undefined) ?? null,
            },
            `${baseName}.geojson`,
          );
        };
        const onExportCsv = () => {
          exportMeasurementAsCsv(measurementToCsvRow(row), `${baseName}.csv`);
        };
        const onExportVector = (format: VectorExportFormat) => {
          const ext = format === 'shp' ? 'zip' : format;
          const filename = `${baseName}.${ext}`;
          const toastId = toast.loading(`Generating ${format.toUpperCase()}…`);
          exportMeasurementVector(row.id, format, filename)
            .then(() => {
              toast.dismiss(toastId);
              toast.success(`${format.toUpperCase()} downloaded.`);
            })
            .catch(() => {
              toast.dismiss(toastId);
              toast.error(`${format.toUpperCase()} export failed.`);
            });
        };
        const hasSurvey = Boolean(row.latest_survey_id);
        const onExportGeoTiff = (source: RasterExportSource) => {
          if (!hasSurvey) return;
          const toastId = toast.loading(`Generating GeoTIFF (${source})…`);
          downloadMeasurementGeoTiff(row.id, source)
            .then(() => {
              toast.dismiss(toastId);
              toast.success(`GeoTIFF (${source}) ready — downloading.`);
            })
            .catch(() => {
              toast.dismiss(toastId);
              toast.error(`GeoTIFF export failed — ${source} raster may be unavailable.`);
            });
        };
        return (
          <div
            key={row.id}
            className="group rounded-sm border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2 hover:border-accent/40 transition-colors"
          >
            <button
              type="button"
              className="flex-1 min-w-0 text-left"
              onClick={() => {
                if (c) flyTo({ lng: c.lng, lat: c.lat, height: 600, label: row.name });
              }}
            >
              <p className="font-medium truncate">{row.name}</p>
              <p className="text-[9px] uppercase tracking-[0.12em] text-text-muted">
                {material}
              </p>
            </button>
            {/* row.qa_status && <QAStatusPill status={row.qa_status} /> */}
            {breaches[row.id] && <RegionAlertTooltip breach={breaches[row.id]} />}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Export ${row.name}`}
                    title="Export"
                    className="opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100 size-5 grid place-items-center rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-surface"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="bg-card border-border-subtle w-52">
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={onExportGeoJson}
                >
                  Export GeoJSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={onExportCsv}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={() => onExportVector('shp')}
                >
                  Shapefile (.zip)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={() => onExportVector('kml')}
                >
                  KML
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={() => onExportVector('kmz')}
                >
                  KMZ
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={() => onExportVector('dxf')}
                >
                  DXF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  disabled={!hasSurvey}
                  onClick={() => onExportGeoTiff('ortho')}
                >
                  GeoTIFF — Ortho clip
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  disabled={!hasSurvey}
                  onClick={() => onExportGeoTiff('dsm')}
                >
                  GeoTIFF — DSM clip
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  disabled={!hasSurvey}
                  onClick={() => onExportGeoTiff('dtm')}
                >
                  GeoTIFF — DTM clip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              aria-label={`Recompute volume for ${row.name}`}
              title={row.computed_at ? `Last computed ${row.computed_at.slice(0, 10)}` : 'Recompute volume'}
              onClick={() => recomputeMutation.mutate(row.id)}
              disabled={recomputeMutation.isPending}
              className="opacity-0 group-hover:opacity-100 text-[9px] uppercase tracking-[0.12em] text-accent hover:text-accent/70 disabled:opacity-30"
            >
              {recomputeMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : 'Recompute'}
            </button>
            <button
              type="button"
              aria-label={`Delete ${row.name}`}
              onClick={() => deleteMutation.mutate(row.id)}
              disabled={deleteMutation.isPending}
              className="opacity-0 group-hover:opacity-100 text-[9px] uppercase tracking-[0.12em] text-red-400 hover:text-red-300 disabled:opacity-30"
            >
              Delete
            </button>
          </div>
        );
      })}
    </div>
  );
};

/* ───────────────────────── Compare ───────────────────────── */

const CompareTab: React.FC = () => {
  const enabled = useCompareStore((s) => s.enabled);
  const epochA = useCompareStore((s) => s.epochA);
  const epochB = useCompareStore((s) => s.epochB);
  const mode = useCompareStore((s) => s.mode);
  const setMode = useCompareStore((s) => s.setMode);
  const setLayerVisibility = useViewerStore((s) => s.setLayerVisibility);
  const availableSurveys = useViewerStore((s) => s.availableSurveys);

  const { data: rows = [], isLoading, error } = useCutFill(epochA, epochB);

  const totals = useMemo(() => {
    const cut = rows.reduce((s, r) => s + (r.cut_volume_m3 ?? 0), 0);
    const fill = rows.reduce((s, r) => s + (r.fill_volume_m3 ?? 0), 0);
    return { cut, fill, net: fill - cut };
  }, [rows]);

  const labelA = availableSurveys.find((s) => s.id === epochA)?.label ?? epochA?.slice(0, 8) ?? '—';
  const labelB = availableSurveys.find((s) => s.id === epochB)?.label ?? epochB?.slice(0, 8) ?? '—';

  function fmtVol(v: number) {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M m³`;
    if (abs >= 10_000) return `${(v / 1_000).toFixed(1)} k m³`;
    return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} m³`;
  }

  const handleModeChange = (next: 'slider' | 'diff') => {
    setMode(next);
    setLayerVisibility('heatmap', next === 'diff');
  };

  if (!enabled) {
    return (
      <EmptyStateNudge
        icon={<Activity className="size-8" />}
        title="Compare epochs"
        hint="Toggle Compare in the top bar (or press C) to load a baseline and a comparison survey."
      />
    );
  }

  return (
    <div className="px-3 py-3 space-y-3 text-[11px] text-text-primary">
      {/* Epoch summary */}
      <div className="rounded-sm border border-border-subtle bg-bg-elevated px-3 py-2 space-y-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
          <MoveHorizontal className="size-3 text-text-muted" />
          <span className="text-text-muted">Comparing</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-text-muted">{labelA}</span>
          <span className="text-text-muted">→</span>
          <span className="truncate font-medium">{labelB}</span>
        </div>
        {!epochA || !epochB ? (
          <p className="text-[10px] text-amber-400 mt-1">
            Select epochs in the dock below the canvas.
          </p>
        ) : null}
      </div>

      {/* KPI grid */}
      {(epochA && epochB) && (
        <div className="grid grid-cols-3 gap-1">
          {[
            { label: 'Cut', value: totals.cut, color: 'text-red-400', Icon: TrendingDown },
            { label: 'Fill', value: totals.fill, color: 'text-blue-400', Icon: TrendingUp },
            { label: 'Net', value: totals.net, color: totals.net >= 0 ? 'text-blue-400' : 'text-red-400', Icon: ArrowDownUp },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="rounded-sm border border-border-subtle bg-bg-elevated p-2 flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1">
                <Icon className={cn('size-3', color)} />
                <span className="text-[9px] uppercase tracking-[0.12em] text-text-muted">{label}</span>
              </div>
              {isLoading ? (
                <Loader2 className="size-3 animate-spin text-text-muted" />
              ) : (
                <span className={cn('text-[12px] font-semibold tabular-nums', color)}>
                  {fmtVol(value)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-[11px] text-red-400 rounded-sm border border-red-400/30 bg-red-400/10 px-2 py-1.5">
          Could not load cut/fill data.
        </p>
      )}

      {/* Zone list */}
      {(epochA && epochB && !isLoading && rows.length > 0) && (
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-[0.15em] text-text-muted px-1">Zones</p>
          {rows.slice().sort((a, b) => a.net_change_m3 - b.net_change_m3).map((row) => (
            <div key={row.id} className="flex items-center gap-2 px-1 py-1 rounded-sm hover:bg-bg-elevated">
              <span className={cn('size-1.5 rounded-full shrink-0', row.net_change_m3 < 0 ? 'bg-red-400' : 'bg-blue-400')} />
              <span className="flex-1 min-w-0 truncate">{row.zone_name || row.zone_id}</span>
              <span className={cn('text-[10px] font-mono tabular-nums shrink-0', row.net_change_m3 < 0 ? 'text-red-400' : 'text-blue-400')}>
                {row.net_change_m3 >= 0 ? '+' : ''}{fmtVol(row.net_change_m3)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-[0.12em] text-text-muted mr-auto">View as</span>
        <div role="group" className="inline-flex items-center rounded-sm border border-border-subtle p-0.5">
          {(['slider', 'diff'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              aria-pressed={mode === m}
              className={cn(
                'h-5 px-2 rounded-sm text-[9px] uppercase tracking-[0.12em] transition-colors',
                mode === m ? 'bg-accent text-[#111]' : 'text-text-muted hover:text-text-primary',
              )}
            >
              {m === 'slider' ? 'Slider' : 'Heatmap'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────── Helpers ───────────────────────── */

function formatDistance(distanceMeters?: number): string {
  if (!distanceMeters || distanceMeters <= 0) return '0 m';
  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(2)} km`
    : `${distanceMeters.toFixed(1)} m`;
}

function formatArea(areaSquareMeters?: number): string {
  if (!areaSquareMeters || areaSquareMeters <= 0) return '0 m²';
  return areaSquareMeters >= 10000
    ? `${(areaSquareMeters / 10000).toFixed(2)} ha`
    : `${areaSquareMeters.toFixed(0)} m²`;
}

