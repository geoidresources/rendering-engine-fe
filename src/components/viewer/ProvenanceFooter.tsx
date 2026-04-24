/**
 * V-TRUST-02 — provenance footer for every volume card.
 *
 * Five-row footer answers the "how was this number computed?" question
 * inline: Method · Terrain source · Base plane · Survey · Computed at.
 * Each row surfaces only what the client already knows; fields without
 * a source yet fall back to a muted em-dash. The design decision (D-5)
 * is that Sprint-1 keeps this FE-only — the richer per-record columns
 * (`computed_at`, `terrain_mode_at_compute`, `base_plane_method`,
 * `sample_count`) arrive in a Sprint-2 BE migration.
 *
 * Stateless by contract — the parent owns every value so the footer can
 * be reused against both the live draft measurement (values sourced
 * from the Zustand store) and persisted saved-region cards (values
 * sourced from the API response).
 */
'use client';

import React from 'react';
import type { TerrainMode, VolumeBasePlane } from '@/store/viewerStore';

interface Props {
  terrainMode: TerrainMode;
  basePlane: VolumeBasePlane | null | undefined;
  /** Survey date in ISO form (`YYYY-MM-DD…`) or `null` when no survey
   *  is active. The footer trims to the date portion for legibility. */
  surveyDate?: string | null;
  /** Epoch ms when the volume sum was last written. `null` / `undefined`
   *  renders "—" with a tooltip explaining the Sprint-1 limitation. */
  computedAtEpochMs?: number | null;
  /** ISO timestamp from the backend `computed_at` column (migration 020).
   *  Takes precedence over computedAtEpochMs when both are set. */
  computedAtIso?: string | null;
  /** Override the default method label when a non-grid integrator is
   *  wired up (e.g. Sprint-2 TIN-based path). */
  methodLabel?: string;
  sampleCount?: number | null;
}

const BASE_PLANE_LABEL: Record<VolumeBasePlane, string> = {
  avg: 'Average of vertices',
  min: 'Minimum vertex',
  max: 'Maximum vertex',
  fitted: 'Least-squares fit',
};

function formatAbsoluteTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTimestamp(epochMs: number): string {
  const deltaMs = Date.now() - epochMs;
  if (deltaMs < 60_000) return 'just now';
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const ProvenanceFooter: React.FC<Props> = ({
  terrainMode,
  basePlane,
  surveyDate,
  computedAtEpochMs,
  computedAtIso,
  methodLabel = 'Terrain-sample grid (25×25)',
  sampleCount,
}) => {
  // Prefer server-stamped ISO over client-side epoch
  const computedAtMs = computedAtIso
    ? new Date(computedAtIso).getTime()
    : computedAtEpochMs ?? null;

  const rows: Array<{ label: string; value: React.ReactNode; title?: string }> = [
    { label: 'Method', value: methodLabel },
    {
      label: 'Terrain',
      value: terrainMode.toUpperCase(),
      title:
        terrainMode === 'dsm'
          ? 'Digital Surface Model — includes vegetation + structures'
          : 'Digital Terrain Model — bare-earth elevation',
    },
    {
      label: 'Base plane',
      value: basePlane ? BASE_PLANE_LABEL[basePlane] : '—',
    },
    {
      label: 'Survey',
      value: surveyDate ? surveyDate.slice(0, 10) : '—',
    },
    ...(sampleCount != null
      ? [{ label: 'Samples', value: sampleCount.toLocaleString() }]
      : []),
    {
      label: 'Computed at',
      value: computedAtMs
        ? `${formatAbsoluteTimestamp(computedAtMs)} · ${formatRelativeTimestamp(computedAtMs)}`
        : '—',
      title: computedAtMs
        ? 'Timestamp of last volume computation.'
        : 'Volume not yet computed — draw and sample the polygon.',
    },
  ];

  return (
    <dl
      className="mt-2 border-t border-border-subtle/70 pt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px] text-text-muted"
      aria-label="Measurement provenance"
    >
      {rows.map((row) => (
        <React.Fragment key={row.label}>
          <dt className="uppercase tracking-[0.12em]">{row.label}</dt>
          <dd
            className="font-mono text-text-secondary truncate"
            title={row.title}
          >
            {row.value}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
};
