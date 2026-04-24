'use client';

import React, { useState } from 'react';
import { Loader2, Info, Check, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AssetLoadStatus = 'pending' | 'loading' | 'done' | 'error';

export interface AssetStatusRow {
  id: string;
  label: string;
  status: AssetLoadStatus;
  errorMessage?: string;
}

interface ViewerLoaderProps {
  /** Fullscreen blocks the viewer on first load; chip floats above the
   *  scene for subsequent asset fetches once critical layers are in. */
  variant: 'fullscreen' | 'chip';
  /** All tracked assets + their current state. Drives cumulative progress
   *  and the (i) popover. */
  assetStatuses: AssetStatusRow[];
  /** Fullscreen: controls fade-in/out. Chip: hides when false. */
  visible: boolean;
}

function StatusIcon({ status }: { status: AssetLoadStatus }) {
  if (status === 'done') return <Check className="size-3 text-emerald-400" />;
  if (status === 'error') return <AlertTriangle className="size-3 text-amber-400" />;
  if (status === 'loading') return <Loader2 className="size-3 text-accent animate-spin" />;
  return (
    <span className="size-3 inline-flex items-center justify-center">
      <span className="size-1.5 rounded-full bg-text-muted/40" />
    </span>
  );
}

function AssetStatusList({ statuses }: { statuses: AssetStatusRow[] }) {
  return (
    <ul className="space-y-1.5 text-[11px] font-mono">
      {statuses.map((s) => (
        <li key={s.id} className="flex items-start gap-2">
          <span className="mt-[3px] shrink-0">
            <StatusIcon status={s.status} />
          </span>
          <span className="flex-1 min-w-0">
            <span
              className={cn(
                'block',
                s.status === 'pending' && 'text-text-muted/60',
                s.status === 'error' && 'text-amber-400',
                (s.status === 'done' || s.status === 'loading') && 'text-text-primary',
              )}
            >
              {s.label}
            </span>
            {s.errorMessage && (
              <span
                className="block text-[10px] text-text-muted/80 mt-0.5 truncate"
                title={s.errorMessage}
              >
                {s.errorMessage}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function summarize(statuses: AssetStatusRow[]) {
  const total = statuses.length;
  const done = statuses.filter((a) => a.status === 'done').length;
  const failed = statuses.filter((a) => a.status === 'error').length;
  const loading = statuses.filter((a) => a.status === 'loading').length;
  const pct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
  const firstLoading = statuses.find((a) => a.status === 'loading');
  const firstError = statuses.find((a) => a.status === 'error');
  const stage =
    firstLoading?.label ??
    (failed > 0 ? `${firstError?.label ?? 'Asset'} failed` : 'Compositing scene');
  return { total, done, failed, loading, pct, stage };
}

export const ViewerLoader: React.FC<ViewerLoaderProps> = ({
  variant,
  assetStatuses,
  visible,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { total, done, failed, loading, pct, stage } = summarize(assetStatuses);

  if (variant === 'chip') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'absolute top-3 left-1/2 -translate-x-1/2 z-30',
          'transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface/85 pl-2.5 pr-1 py-0.5 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-bg-surface/65">
            {loading > 0 ? (
              <Loader2 className="size-3 text-accent animate-spin" />
            ) : failed > 0 ? (
              <AlertTriangle className="size-3 text-amber-400" />
            ) : (
              <Check className="size-3 text-emerald-400" />
            )}
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted tabular-nums">
              {pct}% · {stage}
            </span>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-label="Toggle asset loading details"
              aria-expanded={showDetails}
              className="pointer-events-auto inline-flex items-center justify-center size-5 rounded-full hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
            >
              <Info className="size-3" />
            </button>
          </div>

          {showDetails && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-72 rounded-sm border border-border-subtle bg-bg-surface/95 shadow-lg backdrop-blur-md p-3 pointer-events-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted">
                  Asset status ({done}/{total})
                </span>
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  aria-label="Close details"
                  className="inline-flex items-center justify-center size-4 rounded hover:bg-bg-elevated text-text-muted hover:text-text-primary"
                >
                  <X className="size-3" />
                </button>
              </div>
              <AssetStatusList statuses={assetStatuses} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // fullscreen variant
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none fixed inset-0 z-[60] flex items-center justify-center',
        'bg-bg-base/95 backdrop-blur-sm',
        'transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="relative flex flex-col items-center gap-5 px-6 text-center max-w-md pointer-events-auto">
        <div className="relative">
          <div className="size-16 rounded-full border border-accent/30 grid place-items-center">
            <Loader2 className="size-8 text-accent animate-spin" />
          </div>
          <div className="absolute inset-0 rounded-full animate-ping bg-accent/10" />
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-text-muted">
            Initializing 3D scene
          </div>
          <div className="text-sm font-medium text-text-primary">{stage}</div>
        </div>

        <div className="w-64 space-y-1.5">
          <div className="h-1 rounded-full bg-bg-elevated overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent/70 to-accent transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-text-muted tabular-nums">
            <span>
              {pct}% · {done}/{total}
              {failed > 0 && (
                <span className="ml-1 text-amber-400">· {failed} failed</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-label="Toggle asset loading details"
              aria-expanded={showDetails}
              className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors"
            >
              <Info className="size-3" />
              <span>{showDetails ? 'hide' : 'details'}</span>
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="w-72 rounded-sm border border-border-subtle bg-bg-surface/95 backdrop-blur-md p-3 text-left">
            <AssetStatusList statuses={assetStatuses} />
          </div>
        )}
      </div>
    </div>
  );
};
