'use client';

import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Columns2,
  Eye,
  EyeOff,
  Layers3,
  LayoutDashboard,
  Loader2,
  MapPinned,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Ruler,
  Square,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { useViewerStore, type LayerId, type RightRailTab } from '@/store/viewerStore';
import { apiClient, unwrapList } from '@/lib/http';
import type { ListEnvelope } from '@/types/api';
import StatusChip, { type StatusTone } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils';
import { EmptyStateNudge } from './EmptyStateNudge';

const SITE_DISTRIBUTION_PALETTE = ['#F59E0B', '#FBBF24', '#FCD34D', '#A78BFA', '#60A5FA', '#FB7185'];

interface RightRailProps {
  /** Active survey id — drives stockpiles + heatmap analytics. */
  surveyId?: string;
  /** Active project id — drives anomaly trends. */
  projectId?: string;
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
  { id: 'measurements', label: 'Measurements', icon: Ruler, shortcut: '4' },
  { id: 'compare', label: 'Compare', icon: Columns2, shortcut: '5' },
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
export const RightRail: React.FC<RightRailProps> = ({ surveyId, projectId }) => {
  const tab = useViewerStore((s) => s.rightRailTab);
  const collapsed = useViewerStore((s) => s.rightRailCollapsed);
  const setTab = useViewerStore((s) => s.setRightRailTab);
  const setCollapsed = useViewerStore((s) => s.setRightRailCollapsed);

  return (
    <aside
      role="complementary"
      aria-label="Site context rail"
      className={cn(
        'shrink-0 h-full flex border-l border-border-subtle bg-bg-surface/85 backdrop-blur-md',
        'supports-[backdrop-filter]:bg-bg-surface/65',
        collapsed ? 'w-9' : 'w-[360px]',
      )}
    >
      {/* Vertical tab strip — always visible; doubles as collapse handle */}
      <div
        role="tablist"
        aria-orientation="vertical"
        className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-border-subtle bg-bg-base/60 py-2"
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
                'h-9 w-7 grid place-items-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
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
          className="h-9 w-7 grid place-items-center rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
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
            {tab === 'inspector' && <InspectorTab />}
            {tab === 'measurements' && <MeasurementsTab />}
            {tab === 'compare' && <CompareTab />}
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
  const { data: anomalies = [], isLoading: anomaliesLoading } = useQuery<AnomalyRow[]>({
    queryKey: ['rail-anomalies', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      type TrendRow = {
        material: string;
        is_anomaly: boolean;
        anomaly_severity: string;
        anomaly_z_score: number;
      };
      const res = await apiClient.get<ListEnvelope<TrendRow>>(
        `/api/v1/analytics/trends?project_id=${projectId}&material=`,
      );
      return unwrapList<TrendRow>(res.data)
        .filter((t) => t.is_anomaly)
        .slice(0, 5)
        .map((t, i) => ({
          id: `a-${i}`,
          material: t.material,
          severity: t.anomaly_severity ?? 'warning',
          message: `z = ${t.anomaly_z_score?.toFixed(2) ?? '—'}`,
        }));
    },
  });

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

  return (
    <div className="px-3 py-3 space-y-3">
      <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted leading-snug">
        Toggles add ortho, points, vectors, and models. Use the toolbar (T) to
        switch DTM/DSM terrain.
      </p>

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
    </div>
  );
};

/* ───────────────────────── Inspector ───────────────────────── */

const InspectorTab: React.FC = () => {
  const selectedFeature = useViewerStore((s) => s.selectedFeature);
  const selectedAreaDetails = useViewerStore((s) => s.selectedAreaDetails);
  const areaDetailsLoading = useViewerStore((s) => s.areaDetailsLoading);
  const activeTool = useViewerStore((s) => s.activeTool);
  const measurement = useViewerStore((s) => s.measurement);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const setSelectedFeature = useViewerStore((s) => s.setSelectedFeature);
  const setSelectedAreaDetails = useViewerStore((s) => s.setSelectedAreaDetails);
  const clearMeasurement = useViewerStore((s) => s.clearMeasurement);

  const isMeasuring =
    activeTool === 'distance' || activeTool === 'area' || activeTool === 'volume';

  if (!isMeasuring && !selectedFeature && !selectedAreaDetails && !areaDetailsLoading) {
    return (
      <EmptyStateNudge
        icon={<MapPinned className="size-8" />}
        title="Pick something on the canvas"
        hint="With Select active, click a polygon, 3D Tile feature, or the site model to inspect properties."
      />
    );
  }

  return (
    <div
      className="px-3 py-3 space-y-3 text-[11px] text-text-primary"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {isMeasuring && (
        <div className="rounded-sm border border-accent/30 bg-accent/10 p-3 leading-snug">
          <div className="mb-2 flex items-center gap-2">
            {activeTool === 'distance' ? (
              <Ruler className="h-4 w-4 text-accent" />
            ) : activeTool === 'area' ? (
              <Square className="h-4 w-4 text-accent" />
            ) : (
              <MapPinned className="h-4 w-4 text-accent" />
            )}
            <span className="font-semibold uppercase tracking-[0.15em] text-[10px]">
              {activeTool === 'distance' ? 'Distance' : activeTool === 'area' ? 'Area' : 'Volume'}{' '}
              tool
            </span>
          </div>
          {activeTool === 'distance' && (
            <>
              <p className="text-text-muted">
                Click to place points. Double-click or right-click to finish.
              </p>
              <p className="mt-2">
                Distance: <strong>{formatDistance(measurement.distanceMeters)}</strong>
              </p>
            </>
          )}
          {activeTool === 'area' && (
            <>
              <p className="text-text-muted">
                Click to add polygon vertices. Right-click to close and measure.
              </p>
              <p className="mt-2">
                Area: <strong>{formatArea(measurement.areaSquareMeters)}</strong>
              </p>
            </>
          )}
          {activeTool === 'volume' && (
            <>
              <p className="text-text-muted">
                Draw a polygon around a stockpile. Right-click to close and compute volume.
              </p>
              <p className="mt-2">
                Area: <strong>{formatArea(measurement.areaSquareMeters)}</strong>
              </p>
              {measurement.volumeCubicMeters !== undefined && (
                <p className="mt-1">
                  Volume: <strong>{formatVolume(measurement.volumeCubicMeters)}</strong>
                </p>
              )}
            </>
          )}
          {measurement.status !== 'idle' && (
            <button
              type="button"
              onClick={() => {
                clearMeasurement();
                setActiveTool('select');
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-accent hover:text-accent-hover transition-colors"
            >
              Clear measurement
            </button>
          )}
        </div>
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

      {selectedFeature && (
        <pre className="whitespace-pre-wrap break-all rounded-sm border border-border-subtle bg-bg-base/70 p-3 font-mono text-[10px] text-text-secondary">
          {JSON.stringify(selectedFeature, null, 2)}
        </pre>
      )}

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

/* ───────────────────────── Measurements ───────────────────────── */

const MeasurementsTab: React.FC = () => {
  return (
    <EmptyStateNudge
      icon={<Pencil className="size-8" />}
      title="No saved measurements yet"
      hint="Press M to start measuring. Saved measurements and drawn regions will appear here."
    />
  );
};

/* ───────────────────────── Compare ───────────────────────── */

const CompareTab: React.FC = () => {
  return (
    <EmptyStateNudge
      icon={<Activity className="size-8" />}
      title="Compare epochs"
      hint="Toggle Compare in the top bar (or press C) to load a baseline and a comparison survey."
    />
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

function formatVolume(volumeCubicMeters?: number): string {
  if (!volumeCubicMeters || volumeCubicMeters <= 0) return '0 m³';
  return `${volumeCubicMeters.toLocaleString(undefined, { maximumFractionDigits: 0 })} m³`;
}
