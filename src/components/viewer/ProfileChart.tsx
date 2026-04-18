'use client';

import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Mountain, Ruler, Sigma, X } from 'lucide-react';
import { useViewerStore } from '@/store/viewerStore';
import { cn } from '@/lib/utils';

/* ─────────────────────── helpers ─────────────────────── */

function fmtDist(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${m.toFixed(0)} m`;
}

function fmtElev(m: number): string {
  return `${m.toFixed(1)} m`;
}

interface ProfileTooltipPayload {
  distance: number;
  height: number;
}

interface ProfileTooltipShape {
  active?: boolean;
  payload?: Array<{ payload?: ProfileTooltipPayload }>;
}

/**
 * Custom tooltip content. recharts 3.x types `content`'s render prop
 * tightly via TooltipContentProps which expects internal fields like
 * `accessibilityLayer` we don't care about — we only read `active` +
 * `payload[0].payload`, both runtime-stable across versions, so we
 * accept a structural subset and bail out if the shape is unexpected.
 */
function renderProfileTooltip(props: unknown): React.ReactNode {
  const { active, payload } = (props ?? {}) as ProfileTooltipShape;
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-sm border border-border-subtle bg-bg-surface/95 px-2 py-1.5 text-[10px] font-mono shadow-lg">
      <div className="text-text-muted">
        d&nbsp;<span className="text-text-primary">{fmtDist(d.distance)}</span>
      </div>
      <div className="text-text-muted">
        z&nbsp;<span className="text-text-primary">{fmtElev(d.height)}</span>
      </div>
    </div>
  );
}

/* ─────────────────────── chart card ─────────────────────── */

/**
 * Bottom-docked elevation-profile chart. Auto-mounts when
 * `viewerStore.profile.samples != null`. Two variants:
 *
 *  - **Profile** — true-ish Y axis (small padding around data).
 *  - **Cross-section** — exaggeration slider stretches the data band
 *    to fill more of the chart height; padding shrinks as `1/e`.
 *
 * Closes via the X button (clears profile state and removes the on-canvas
 * polyline through `useProfileHandler`'s cleanup effect).
 */
export const ProfileChart: React.FC = () => {
  const samples = useViewerStore((s) => s.profile.samples);
  const mode = useViewerStore((s) => s.profile.mode);
  const exaggeration = useViewerStore((s) => s.profile.exaggeration);
  const setExaggeration = useViewerStore((s) => s.setProfileExaggeration);
  const clearProfile = useViewerStore((s) => s.clearProfile);

  // Derive stats + Y domain from the samples. All useMemo so we don't
  // recompute on the exaggeration-slider drag (only `domain` does).
  const stats = useMemo(() => {
    if (!samples || samples.length === 0) return null;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const s of samples) {
      if (s.height < yMin) yMin = s.height;
      if (s.height > yMax) yMax = s.height;
    }
    const totalDist = samples[samples.length - 1].distance;
    const dataSpan = Math.max(yMax - yMin, 0.5);
    return { yMin, yMax, totalDist, dataSpan, delta: yMax - yMin };
  }, [samples]);

  const yDomain = useMemo<[number, number]>(() => {
    if (!stats) return [0, 1];
    // Padding shrinks as exaggeration grows. e=1 → 50% padding (data
    // fills middle 50% of chart), e=∞ → no padding (data fills chart).
    const padding = stats.dataSpan / Math.max(exaggeration, 0.1);
    return [stats.yMin - padding * 0.5, stats.yMax + padding * 0.5];
  }, [stats, exaggeration]);

  if (!samples || !stats) return null;

  const isCrossSection = mode === 'cross-section';

  return (
    <div
      role="dialog"
      aria-label="Elevation profile"
      className={cn(
        'absolute bottom-28 left-1/2 -translate-x-1/2 z-20',
        'w-[min(820px,calc(100vw-32px))] rounded-sm border border-border-subtle',
        'bg-bg-surface/90 supports-[backdrop-filter]:bg-bg-surface/75 backdrop-blur-md shadow-2xl',
        'flex flex-col',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Mountain className="size-3.5 text-accent" />
          <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-primary">
            {isCrossSection ? 'Cross-section' : 'Elevation profile'}
          </span>
          <span className="text-[10px] text-text-muted">
            · {samples.length} samples
          </span>
        </div>
        <button
          type="button"
          onClick={clearProfile}
          aria-label="Close profile chart"
          className="size-6 inline-flex items-center justify-center rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border-subtle bg-bg-elevated/40 text-[10px] font-mono">
        <span className="flex items-center gap-1 text-text-muted">
          <Ruler className="size-3" />
          <span className="text-text-primary">{fmtDist(stats.totalDist)}</span>
        </span>
        <span className="flex items-center gap-1 text-text-muted">
          <Sigma className="size-3" />
          Δz&nbsp;<span className="text-text-primary">{fmtElev(stats.delta)}</span>
        </span>
        <span className="text-text-muted">
          min&nbsp;<span className="text-text-primary">{fmtElev(stats.yMin)}</span>
        </span>
        <span className="text-text-muted">
          max&nbsp;<span className="text-text-primary">{fmtElev(stats.yMax)}</span>
        </span>
        {isCrossSection && (
          <span className="ml-auto flex items-center gap-2 text-text-muted">
            VE&nbsp;<span className="text-accent tabular-nums">{exaggeration.toFixed(1)}×</span>
            <input
              type="range"
              min={1}
              max={20}
              step={0.5}
              value={exaggeration}
              onChange={(e) => setExaggeration(parseFloat(e.target.value))}
              aria-label="Vertical exaggeration"
              className="w-32 accent-[var(--color-accent,#22d3ee)]"
            />
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 py-2" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={samples}
            margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border-subtle, #1f2a37)" strokeDasharray="2 4" />
            <XAxis
              dataKey="distance"
              type="number"
              domain={[0, stats.totalDist]}
              tick={{ fontSize: 10, fill: 'var(--color-text-muted, #64748b)' }}
              tickFormatter={fmtDist}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border-subtle, #1f2a37)' }}
              minTickGap={32}
            />
            <YAxis
              dataKey="height"
              type="number"
              domain={yDomain}
              tick={{ fontSize: 10, fill: 'var(--color-text-muted, #64748b)' }}
              tickFormatter={(v: number) => v.toFixed(0)}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border-subtle, #1f2a37)' }}
              width={42}
            />
            <Tooltip
              cursor={{ stroke: '#22d3ee', strokeOpacity: 0.4, strokeWidth: 1 }}
              content={renderProfileTooltip}
            />
            <Area
              type="monotone"
              dataKey="height"
              stroke="#22d3ee"
              strokeWidth={1.5}
              fill="url(#profile-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
