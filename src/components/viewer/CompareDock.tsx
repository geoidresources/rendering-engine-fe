'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  ChevronDown,
  Download,
  Layers3,
  Loader2,
  MoveHorizontal,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useCompareStore } from '@/store/compareStore';
import { useViewerStore } from '@/store/viewerStore';
import { useCutFill } from '@/hooks/useCutFill';
import { cn } from '@/lib/utils';
import type { CutFillRecord } from '@/types/api';

type SortKey = 'net' | 'cut' | 'fill';

/* ─────────────────────── helpers ─────────────────────── */

function fmtVol(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M m³`;
  if (abs >= 10_000) return `${(v / 1_000).toFixed(1)} k m³`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} m³`;
}

function fmtSign(v: number): string {
  return v >= 0 ? `+${fmtVol(v)}` : fmtVol(v);
}

/* ─────────────────────── epoch selector ─────────────────────── */

interface EpochSelectorProps {
  label: string;
  value: string | null;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}

const EpochSelector: React.FC<EpochSelectorProps> = ({ label, value, options, onChange }) => (
  <div className="flex items-center gap-1.5 min-w-0">
    <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted shrink-0">{label}</span>
    <div className="relative min-w-0 flex-1">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-sm border border-border-subtle bg-bg-elevated px-2 py-0.5 pr-6 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/60 cursor-pointer truncate"
        aria-label={`Select ${label} epoch`}
      >
        <option value="" disabled>Pick epoch…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-text-muted" />
    </div>
  </div>
);

/* ─────────────────────── zone row ─────────────────────── */

interface ZoneRowProps {
  row: CutFillRecord;
  onFly: (row: CutFillRecord) => void;
}

const ZoneRow: React.FC<ZoneRowProps> = ({ row, onFly }) => {
  const net = row.net_change_m3;
  const isCut = net < 0;
  const suspect = row.quality_suspect === true;
  return (
    <button
      type="button"
      onClick={() => onFly(row)}
      className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-bg-elevated transition-colors text-left group"
    >
      <span className={cn('size-1.5 rounded-full shrink-0', isCut ? 'bg-red-400' : 'bg-blue-400')} />
      <span
        className={cn(
          'flex-1 min-w-0 truncate text-[11px]',
          suspect ? 'text-text-muted' : 'text-text-primary',
        )}
      >
        {row.zone_name || row.zone_id || 'Unknown zone'}
      </span>
      {suspect && (
        <span
          // The chip mirrors the dock-level banner in colour so an operator
          // who scans only the list still sees the same red signal. The
          // tooltip carries the human-readable reason from the gate.
          title={row.quality_reason ?? 'Numbers may be unreliable.'}
          className="shrink-0 inline-flex items-center gap-0.5 rounded-sm border border-red-400/40 bg-red-400/10 px-1 py-0.5 text-[8px] uppercase tracking-[0.12em] text-red-400"
        >
          <AlertTriangle className="size-2.5" />
          Suspect
        </span>
      )}
      <span
        className={cn(
          'text-[10px] font-mono tabular-nums shrink-0',
          suspect && 'line-through opacity-60',
          isCut ? 'text-red-400' : 'text-blue-400',
        )}
      >
        {fmtSign(net)}
      </span>
    </button>
  );
};

/* ─────────────────────── main component ─────────────────────── */

/**
 * CompareDock — floating bottom-centre dock shown only when compare is active.
 *
 * Layout: epoch A/B pickers → Cut/Fill/Net KPIs → zone list (sortable) →
 * mode toggle (Slider ↔ Heatmap) + Export pill.
 *
 * Heatmap mode: delegates to viewerStore.setLayerVisibility('heatmap', true)
 * — the heatmap layer is already loaded from the manifest's diff_raster_url.
 *
 * Slider mode: sets compareStore.splitPosition, consumed by a drag overlay
 * rendered inside Viewer.tsx directly above the Cesium canvas.
 */
export const CompareDock: React.FC = () => {
  const enabled = useCompareStore((s) => s.enabled);
  const epochA = useCompareStore((s) => s.epochA);
  const epochB = useCompareStore((s) => s.epochB);
  const mode = useCompareStore((s) => s.mode);
  const setEpochs = useCompareStore((s) => s.setEpochs);
  const setMode = useCompareStore((s) => s.setMode);

  const availableSurveys = useViewerStore((s) => s.availableSurveys);
  const setLayerVisibility = useViewerStore((s) => s.setLayerVisibility);
  const flyTo = useViewerStore((s) => s.flyTo);
  const manifest = useViewerStore((s) => s.manifest);

  const [sortKey, setSortKey] = useState<SortKey>('net');
  const [exporting, setExporting] = useState(false);
  // Banner is dismissable per session via local state — operators should
  // re-see it on a fresh dock mount (toggle compare off/on or page refresh)
  // because the suspect signal can change as rows finish (re)processing.
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data: rows = [], isLoading, error } = useCutFill(epochA, epochB);

  // KPI totals
  const totals = useMemo(() => {
    const cut = rows.reduce((s, r) => s + (r.cut_volume_m3 ?? 0), 0);
    const fill = rows.reduce((s, r) => s + (r.fill_volume_m3 ?? 0), 0);
    return { cut, fill, net: fill - cut };
  }, [rows]);

  // Quality gate aggregation. anySuspect drives the KPI mute + the banner
  // visibility; suspectReasons is the de-duped, human-readable summary the
  // banner uses so the operator sees one short sentence for many rows
  // tripping the same signal.
  const { anySuspect, suspectReasons } = useMemo(() => {
    const suspectRows = rows.filter((r) => r.quality_suspect === true);
    if (suspectRows.length === 0) {
      return { anySuspect: false, suspectReasons: '' };
    }
    const codeToLabel: Record<string, string> = {
      datum_mismatch: 'vertical datum mismatch',
      extreme_depth: 'implausible effective depth',
    };
    const labels = Array.from(
      new Set(
        suspectRows.map(
          (r) => codeToLabel[r.quality_reason_code ?? ''] ?? 'data quality issue',
        ),
      ),
    );
    return { anySuspect: true, suspectReasons: labels.join(', ') };
  }, [rows]);

  const showBanner = anySuspect && !bannerDismissed;

  // Sorted zone list
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (sortKey === 'net') return a.net_change_m3 - b.net_change_m3;
        if (sortKey === 'cut') return b.cut_volume_m3 - a.cut_volume_m3;
        return b.fill_volume_m3 - a.fill_volume_m3;
      }),
    [rows, sortKey],
  );

  // Sync heatmap layer visibility with mode
  const handleModeChange = (next: 'slider' | 'diff') => {
    setMode(next);
    setLayerVisibility('heatmap', next === 'diff');
  };

  const handleFly = (row: CutFillRecord) => {
    // Use manifest bounds as fallback; zone centroid would require extra geometry
    const b = manifest?.bounds;
    if (!b) return;
    flyTo({
      lng: (b.west + b.east) / 2,
      lat: (b.south + b.north) / 2,
      height: 1200,
      label: row.zone_name || row.zone_id,
    });
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Trigger CSV download via rendering-engine-be export endpoint when available.
      // Phase 2: open a placeholder link; backend endpoint wired in Phase 6.
      const url = `/api/v1/reports/export?kind=cutfill&baseline=${epochA ?? ''}&comparison=${epochB ?? ''}`;
      window.open(url, '_blank', 'noopener');
    } finally {
      setExporting(false);
    }
  };

  if (!enabled) return null;

  return (
    <div
      role="region"
      aria-label="Cut / fill comparison"
      className={cn(
        'absolute bottom-9 left-1/2 -translate-x-1/2 z-20',
        'w-[520px] max-w-[calc(100vw-8rem)]',
        'rounded-sm border border-border-subtle bg-bg-surface/90 backdrop-blur-md',
        'supports-[backdrop-filter]:bg-bg-surface/75',
        'shadow-2xl text-text-primary',
      )}
    >
      {/* ── Epoch pickers ────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle">
        <EpochSelector
          label="Baseline"
          value={epochA}
          options={availableSurveys}
          onChange={(id) => setEpochs(id, epochB)}
        />
        <MoveHorizontal className="size-3.5 text-text-muted shrink-0" />
        <EpochSelector
          label="Compare"
          value={epochB}
          options={availableSurveys}
          onChange={(id) => setEpochs(epochA, id)}
        />
      </div>

      {/* ── Suspect banner (Cut-Fill Quality Gate Addendum) ─────────── */}
      {showBanner && (
        <div
          role="alert"
          className="flex items-start gap-2 px-3 py-2 border-b border-border-subtle bg-red-400/10 text-red-400"
        >
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-[11px] leading-tight">
            <span className="font-semibold">Numbers may be unreliable</span>
            {suspectReasons && (
              <span className="text-text-muted"> — {suspectReasons}.</span>
            )}
            <span className="text-text-muted">
              {' '}
              Hover any row marked Suspect for details.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss data-quality warning"
            className="shrink-0 p-0.5 rounded-sm hover:bg-red-400/20 transition-colors"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* ── KPI row ────────────────────────────────────── */}
      <div className="grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle">
        {[
          { label: 'Cut', value: totals.cut, color: 'text-red-400', Icon: TrendingDown },
          { label: 'Fill', value: totals.fill, color: 'text-blue-400', Icon: TrendingUp },
          { label: 'Net', value: totals.net, color: totals.net >= 0 ? 'text-blue-400' : 'text-red-400', Icon: ArrowDownUp },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 py-2">
            <div className="flex items-center gap-1">
              <Icon className={cn('size-3', anySuspect ? 'text-text-muted' : color)} />
              <span className="text-[9px] uppercase tracking-[0.15em] text-text-muted">{label}</span>
            </div>
            <span
              // When any row in the result trips the quality gate, mute the
              // headline KPIs so the user doesn't read them as authoritative;
              // the per-row chips still let them inspect which rows are bad.
              title={anySuspect ? 'At least one zone tripped the data-quality gate — see Suspect chips below.' : undefined}
              className={cn(
                'text-[13px] font-semibold tabular-nums',
                anySuspect ? 'text-text-muted line-through opacity-70' : color,
              )}
            >
              {isLoading ? '—' : fmtVol(value)}
            </span>
          </div>
        ))}
      </div>

      {/* ── Zone list ─────────────────────────────────── */}
      <div className="px-1 py-1 max-h-36 overflow-y-auto">
        {!epochA || !epochB ? (
          <p className="text-[11px] text-text-muted text-center py-3">
            Pick a baseline and comparison epoch above.
          </p>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 py-3 text-text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="text-[11px]">Loading zones…</span>
          </div>
        ) : error ? (
          <p className="text-[11px] text-red-400 text-center py-3">
            Could not load cut/fill data.
          </p>
        ) : sorted.length === 0 ? (
          <p className="text-[11px] text-text-muted text-center py-3">
            No zone data for this epoch pair.
          </p>
        ) : (
          sorted.map((row) => <ZoneRow key={row.id} row={row} onFly={handleFly} />)
        )}
      </div>

      {/* ── Footer: sort + mode + export ──────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border-subtle">
        {/* Sort picker */}
        <div className="flex items-center gap-1 mr-auto">
          <span className="text-[9px] uppercase tracking-[0.12em] text-text-muted">Sort</span>
          {(['net', 'cut', 'fill'] as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortKey(k)}
              className={cn(
                'h-5 px-1.5 rounded-sm text-[9px] uppercase tracking-[0.12em] transition-colors',
                sortKey === k
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div
          role="group"
          aria-label="Compare mode"
          className="inline-flex items-center rounded-sm border border-border-subtle p-0.5"
        >
          <button
            type="button"
            onClick={() => handleModeChange('slider')}
            title="Drag-to-reveal slider"
            aria-pressed={mode === 'slider'}
            className={cn(
              'h-5 px-2 rounded-sm text-[9px] uppercase tracking-[0.12em] transition-colors flex items-center gap-1',
              mode === 'slider'
                ? 'bg-accent text-[#111]'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            <MoveHorizontal className="size-3" />
            Slider
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('diff')}
            title="Heatmap overlay"
            aria-pressed={mode === 'diff'}
            className={cn(
              'h-5 px-2 rounded-sm text-[9px] uppercase tracking-[0.12em] transition-colors flex items-center gap-1',
              mode === 'diff'
                ? 'bg-accent text-[#111]'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            <Layers3 className="size-3" />
            Heatmap
          </button>
        </div>

        {/* Export */}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !epochA || !epochB}
          title="Export cut/fill report as CSV"
          className="h-5 px-2 rounded-sm border border-border-subtle text-[9px] uppercase tracking-[0.12em] text-text-muted hover:text-text-primary transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="size-3" />
          Export
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────── slider overlay ─────────────────────── */

/**
 * CompareSliderOverlay — a full-canvas drag handle that controls
 * `compareStore.splitPosition`. Rendered INSIDE the canvas wrapper div in
 * Viewer.tsx so it sits on top of Cesium without disturbing the rail layout.
 *
 * pointer-events are none on the dimmed halves and only active on the handle
 * bar itself, so Cesium still receives orbit/pan gestures everywhere except
 * directly on the handle.
 */
export const CompareSliderOverlay: React.FC = () => {
  const splitPosition = useCompareStore((s) => s.splitPosition);
  const setSplitPosition = useCompareStore((s) => s.setSplitPosition);
  const mode = useCompareStore((s) => s.mode);
  const enabled = useCompareStore((s) => s.enabled);

  if (!enabled || mode !== 'slider') return null;

  const pct = `${(splitPosition * 100).toFixed(1)}%`;

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // For mouse, only move while button is held. For touch/stylus, the finger
    // being down is the equivalent — pointerType distinguishes them.
    if (e.pointerType === 'mouse' && e.buttons !== 1) return;
    const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
    setSplitPosition(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none"
      aria-hidden="true"
    >
      {/* Drag-capture surface — intercepts pointer move only while button/finger held.
          touch-action:none prevents the browser scrolling the page while swiping the slider. */}
      <div
        className="absolute inset-0 pointer-events-auto cursor-col-resize select-none"
        onPointerMove={onPointerMove}
        onPointerDown={(e) => (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}
        onPointerUp={(e) => (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)}
        style={{ background: 'transparent', touchAction: 'none' }}
      />

      {/* Vertical divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/70 shadow-lg pointer-events-none"
        style={{ left: pct }}
      />

      {/* Handle pill */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-5 rounded-full bg-white/90 shadow-lg flex items-center justify-center pointer-events-none"
        style={{ left: pct }}
      >
        <MoveHorizontal className="size-3 text-[#111]" />
      </div>

      {/* Epoch labels */}
      <div
        className="absolute top-12 left-3 rounded-sm bg-black/50 px-2 py-0.5 text-[10px] text-white uppercase tracking-[0.12em] pointer-events-none"
      >
        Baseline
      </div>
      <div
        className="absolute top-12 right-3 rounded-sm bg-black/50 px-2 py-0.5 text-[10px] text-white uppercase tracking-[0.12em] pointer-events-none"
      >
        Compare
      </div>
    </div>
  );
};
