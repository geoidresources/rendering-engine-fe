'use client';

/**
 * Measurement results card — the InspectorTab's adaptive readout for
 * everything the Measure tool can produce. Replaces the earlier
 * three-number stub (lines 636–699 of `RightRail.tsx` pre-edit).
 *
 * One component, five sub-views by `measurement.tool` / `profile.mode`:
 *
 *   Distance       — total + ground + slant-vs-ground delta, vertex /
 *                    segment counts, bearing (start → end), elevation
 *                    envelope of the picked vertices
 *   Area           — area, perimeter, vertices, centroid, bbox span,
 *                    elevation envelope, "Compute volume" upgrade,
 *                    "Save as region"
 *   Volume         — net volume + cut/fill split (signed), tonnage with
 *                    a material picker (live FE estimate via the bulk
 *                    density LUT — backend recomputes on Save), base
 *                    plane dropdown driving `recomputeVolume`, sample
 *                    count + confidence badge, area / perimeter /
 *                    centroid, "Save as stockpile" + "Compare with last
 *                    survey" (disabled-with-tooltip stub)
 *   Profile / Cross-section
 *                  — total distance, min/max/mean elevation, gain,
 *                    loss, avg + max grade %, sample count + provider
 *                    name; bench/valley count for cross-section
 *
 * The card delegates derivations to pure helpers — `profileMetrics.ts`
 * for the slope KPIs, `measurementPrimitives.ts` for the per-segment
 * geometry, `materials/densities.ts` for tonnage estimates — so the
 * JSX stays declarative and the math has one home for tests + reuse.
 *
 * Not split into `<DistanceCard>` / `<AreaCard>` / `<VolumeCard>` files
 * because the shared chrome (header / KPI grid / action row) is the
 * point — splitting would mean four copies of the wrapper.
 *
 * @see plans/quirky-munching-corbato.md — "Measurement Results Card
 *      Addendum" for the per-tool field tables and PRD stage mapping.
 */

import React, { useId, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Compass,
  Download,
  Hexagon,
  Layers as LayersIcon,
  Mountain,
  Ruler,
  Save,
  Scale,
  Square,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { Cartesian3, type Viewer as CesiumViewer } from 'cesium';
import { toast } from 'sonner';

import {
  useViewerStore,
  type MeasurementPoint,
  type MeasurementState,
  type ProfileSample,
  type VolumeBasePlane,
  type InspectorDataView,
} from '@/store/viewerStore';
import { computeLensStats } from '@/lib/api/lensStatsApi';
import {
  computeBearingDeg,
  computeGroundDistanceMeters,
  computePerimeterMeters,
  formatArea,
  formatDistance,
  formatVolume,
  sampleTerrainAlongPolyline,
} from '@/lib/cesium/measurementPrimitives';
import {
  bboxSpan,
  centroidOf,
  computeProfileMetrics,
  countBenchExtrema,
  vertexElevationStats,
} from '@/lib/cesium/profileMetrics';
import {
  densityFor,
  formatDensity,
  formatTonnage,
} from '@/lib/materials/densities';
import { useMaterials, FALLBACK_MATERIALS } from '@/hooks/useMaterials';
import {
  resolveDensity,
  useMaterialDensities,
} from '@/hooks/useMaterialDensities';
import {
  useCutFillComputeStatus,
  useCutFillComputeSubmit,
} from '@/hooks/useCutFillCompute';
import {
  estimateVolumeError,
  rmseForTerrain,
  toneForErrorPct,
  type VolumeErrorEstimate,
} from '@/lib/viewer/terrainRmse';
import { ProvenanceFooter } from './ProvenanceFooter';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportMeasurementAsGeoJson } from '@/lib/export/geojsonExport';
import { exportMeasurementAsCsv, type MeasurementRow } from '@/lib/export/csvExport';
import {
  exportInlineVector,
  exportInlineGeoTiff,
  type VectorExportFormat,
  type RasterExportSource,
} from '@/lib/export/vectorExport';

interface Props {
  projectId: string | null | undefined;
  /** Active Cesium viewer ref — needed for `recomputeVolume` to re-run
   *  the terrain sampler when the operator picks a different base
   *  plane. The card is the only consumer that needs viewer access; the
   *  rest of the rail is content with store state. */
  viewerRef: React.RefObject<CesiumViewer | null>;
}

/* ─────────────────────── helpers ─────────────────────── */

/** Convert WGS-84 (deg, deg, m) measurement points → Cesium Cartesian3.
 *  Used by the perimeter / ground-distance / bearing helpers, which
 *  speak Cartesian3 because they originated as primitives in the click
 *  handler where the user's picks already are Cartesian3. Kept inline
 *  rather than living in `measurementPrimitives.ts` — it's a card-only
 *  adapter and its presence in the primitives module would tempt other
 *  callers to round-trip degrees → cartesian → cartographic, the most
 *  expensive way to compute anything. */
function pointsToCartesian(points: MeasurementPoint[]): Cartesian3[] {
  return points.map((p) =>
    Cartesian3.fromDegrees(p.longitude, p.latitude, p.height),
  );
}

/** Compass label for a 0–360° bearing — N / NE / E / SE / S / SW / W /
 *  NW. Matches the cardinal fidelity an operator can resolve at a
 *  glance; finer 16-point detail belongs in a dedicated bearing card. */
function bearingLabel(deg: number): string {
  const ix = Math.round(deg / 45) % 8;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][ix];
}

function formatLatLng(d: number): string {
  return d.toFixed(5) + '°';
}

function formatElevation(m: number): string {
  return `${m.toFixed(1)} m`;
}

function formatGradePct(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

function formatBearing(deg: number): string {
  return `${deg.toFixed(0)}° ${bearingLabel(deg)}`;
}

function formatBboxSpan(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(0)} m`;
}

interface KPI {
  label: string;
  value: React.ReactNode;
  hint?: string;
}

/** Two-column KPI grid — matches the density of the existing rail
 *  property tables (`InspectorTab` selected-feature properties at
 *  `RightRail.tsx:701`+) so the card doesn't visually shout. */
const KpiGrid: React.FC<{ items: KPI[] }> = ({ items }) => (
  <dl
    className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]"
    style={{ fontVariantNumeric: 'tabular-nums' }}
  >
    {items.map((kpi) => (
      <div key={kpi.label} className="flex flex-col gap-0.5 min-w-0">
        <dt
          className="text-[9px] uppercase tracking-[0.12em] text-text-muted"
          title={kpi.hint}
        >
          {kpi.label}
        </dt>
        <dd className="text-text-primary font-mono truncate">{kpi.value}</dd>
      </div>
    ))}
  </dl>
);

/** Thin section divider inside the unified measurement card — a label
 *  + hairline rule so sections read as distinct without duplicating the
 *  CardHeader chrome. */
const SectionLabel: React.FC<{
  icon: React.ReactNode;
  label: string;
}> = ({ icon, label }) => (
  <div className="flex items-center gap-1.5 pt-0.5">
    <span className="shrink-0 text-text-muted/70">{icon}</span>
    <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted whitespace-nowrap">
      {label}
    </span>
    <div className="flex-1 h-px bg-border-subtle" />
  </div>
);

/** Horizontal pill row used for cut / fill / net chips on the Volume
 *  card — high-density visual hierarchy without taking the full grid
 *  width. */
const ChipRow: React.FC<{
  items: { label: string; value: string; tone?: 'cut' | 'fill' | 'net' }[];
}> = ({ items }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((c) => (
      <div
        key={c.label}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] font-mono',
          c.tone === 'cut' && 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
          c.tone === 'fill' && 'bg-sky-500/10 text-sky-300 border border-sky-500/20',
          c.tone === 'net' && 'bg-accent/15 text-accent border border-accent/30',
          !c.tone && 'bg-bg-elevated text-text-muted border border-border-subtle',
        )}
      >
        <span className="uppercase tracking-[0.1em] opacity-80">{c.label}</span>
        <span>{c.value}</span>
      </div>
    ))}
  </div>
);

/** Card header — icon + title + optional close button. The close button
 *  reuses the existing measurement-clear flow rather than introducing a
 *  new "dismiss card" semantic. */
const CardHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClear?: () => void;
}> = ({ icon, title, subtitle, onClear }) => (
  <div className="mb-2 flex items-start justify-between gap-2">
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-accent shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-primary">
          {title}
        </div>
        {subtitle && (
          <div className="text-[10px] text-text-muted truncate">{subtitle}</div>
        )}
      </div>
    </div>
    {onClear && (
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear measurement"
        className="size-6 inline-flex items-center justify-center rounded-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
      >
        <X className="size-3.5" />
      </button>
    )}
  </div>
);

/* ─────────────────────── sub-views ─────────────────────── */

const DistanceSubView: React.FC<{
  measurement: MeasurementState;
}> = ({ measurement }) => {
  const points = measurement.points;
  const derived = useMemo(() => {
    if (points.length < 2) return null;
    const carts = pointsToCartesian(points);
    const slant = measurement.distanceMeters ?? 0;
    const ground = computeGroundDistanceMeters(carts);
    const bearing = computeBearingDeg(carts[0], carts[carts.length - 1]);
    const elev = vertexElevationStats(points);
    return { slant, ground, bearing, elev, carts };
  }, [points, measurement.distanceMeters]);

  return (
    <div className="space-y-2">
      {!derived ? (
        <p className="text-[11px] text-text-muted">
          Place at least two points to see results.
        </p>
      ) : (
        <>
          <KpiGrid
            items={[
              {
                label: 'Total (slant)',
                value: <strong>{formatDistance(derived.slant)}</strong>,
                hint: '3D distance including vertical deltas',
              },
              {
                label: 'Ground (2D)',
                value: formatDistance(derived.ground),
                hint: 'Geodesic surface distance, ignoring elevation',
              },
              {
                label: 'Slant − Ground',
                value: formatDistance(Math.max(derived.slant - derived.ground, 0)),
                hint: 'Vertical-component contribution to the slant length',
              },
              {
                label: 'Bearing',
                value: formatBearing(derived.bearing),
                hint: 'Compass heading from first to last vertex',
              },
            ]}
          />
          {derived.elev && (
            <div className="rounded-sm border border-border-subtle bg-bg-base/60 p-2">
              <div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-text-muted">
                Elevation envelope (vertices)
              </div>
              <KpiGrid
                items={[
                  { label: 'Min', value: formatElevation(derived.elev.min) },
                  { label: 'Max', value: formatElevation(derived.elev.max) },
                  { label: 'Mean', value: formatElevation(derived.elev.mean) },
                  {
                    label: 'Δ',
                    value: formatElevation(derived.elev.max - derived.elev.min),
                  },
                ]}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

const AreaSubView: React.FC<{
  measurement: MeasurementState;
}> = ({ measurement }) => {
  const points = measurement.points;
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const setMeasurement = useViewerStore((s) => s.setMeasurement);

  const derived = useMemo(() => {
    if (points.length < 3) return null;
    const carts = pointsToCartesian(points);
    const perimeter = computePerimeterMeters(carts);
    const center = centroidOf(points);
    const bbox = bboxSpan(points);
    const elev = vertexElevationStats(points);
    return { perimeter, center, bbox, elev };
  }, [points]);

  const isComplete = measurement.status === 'complete';
  const area = measurement.areaSquareMeters ?? 0;

  // "Compute volume" upgrade — flips the active tool while preserving
  // the polygon vertices. Volume tool's effect resets the handler
  // state, so we re-seed the measurement after the flip; otherwise the
  // user would have to redraw.
  const upgradeToVolume = () => {
    if (!isComplete || points.length < 3) return;
    setActiveTool('volume');
    // Defer the seed by one tick so the volume handler's reset doesn't
    // clobber it. The handler's effect runs synchronously on activeTool
    // change and clears the measurement before our seed lands.
    setTimeout(() => {
      setMeasurement({
        tool: 'volume',
        status: 'drawing',
        points,
        areaSquareMeters: area,
      });
    }, 0);
    toast.info('Volume tool armed — right-click to compute the stockpile.', {
      description:
        'Polygon preserved; the next right-click samples the terrain inside it.',
    });
  };

  return (
    <div className="space-y-2">
      <KpiGrid
        items={[
          { label: 'Area', value: <strong>{formatArea(area)}</strong> },
          {
            label: 'Perimeter',
            value: derived ? formatDistance(derived.perimeter) : '—',
          },
          { label: 'Vertices', value: points.length.toString() },
          {
            label: 'Bbox span',
            value: derived?.bbox
              ? `${formatBboxSpan(derived.bbox.widthMeters)} × ${formatBboxSpan(derived.bbox.heightMeters)}`
              : '—',
          },
        ]}
      />

      {derived?.center && (
        <div className="rounded-sm border border-border-subtle bg-bg-base/60 p-2">
          <div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-text-muted">
            Centroid
          </div>
          <KpiGrid
            items={[
              { label: 'Lat', value: formatLatLng(derived.center.latitude) },
              { label: 'Lng', value: formatLatLng(derived.center.longitude) },
              { label: 'Elev', value: formatElevation(derived.center.height) },
            ]}
          />
        </div>
      )}

      {derived?.elev && (
        <div className="rounded-sm border border-border-subtle bg-bg-base/60 p-2">
          <div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-text-muted">
            Elevation envelope (vertices)
          </div>
          <KpiGrid
            items={[
              { label: 'Min', value: formatElevation(derived.elev.min) },
              { label: 'Max', value: formatElevation(derived.elev.max) },
              { label: 'Mean', value: formatElevation(derived.elev.mean) },
              {
                label: 'Δ',
                value: formatElevation(derived.elev.max - derived.elev.min),
              },
            ]}
          />
        </div>
      )}

      {isComplete && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={upgradeToVolume}
            className="inline-flex items-center gap-1.5 rounded-sm border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-accent hover:bg-accent/20 transition-colors"
          >
            <ArrowUpRight className="size-3" /> Compute volume
          </button>
        </div>
      )}
    </div>
  );
};

/** Confidence badge for the Volume sub-view — drives operator trust in
 *  the live FE volume estimate. Sampling thresholds match the plan
 *  (`≥200 high`, `50–200 medium`, `<50 low`). */
function confidenceFor(sampleCount: number): {
  tone: 'high' | 'med' | 'low';
  label: string;
} {
  if (sampleCount >= 200) return { tone: 'high', label: 'High' };
  if (sampleCount >= 50) return { tone: 'med', label: 'Medium' };
  return { tone: 'low', label: 'Low' };
}

const StockpileFootprintSVG: React.FC<{
  points: MeasurementPoint[];
  meanHeight: number;
}> = ({ points, meanHeight }) => {
  const reactId = useId();
  const patternId = `fp-grid-${reactId.replace(/:/g, '')}`;
  const W = 200, H = 110;
  const PAD = 16;

  if (points.length < 3) return null;

  const lngs = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const lngSpan = maxLng - minLng || 0.0001;
  const latSpan = maxLat - minLat || 0.0001;

  const usableW = W - PAD * 2;
  const usableH = H - PAD * 2 - 10;
  const scale = Math.min(usableW / lngSpan, usableH / latSpan) * 0.85;
  const projW = lngSpan * scale;
  const projH = latSpan * scale;
  const offX = (W - projW) / 2;
  const offY = (H - 10 - projH) / 2;

  const toSVG = (lng: number, lat: number): [number, number] => [
    offX + (lng - minLng) * scale,
    offY + projH - (lat - minLat) * scale,
  ];

  const polyPts = points.map((p) => toSVG(p.longitude, p.latitude).join(',')).join(' ');
  const cx = offX + projW / 2;
  const cy = offY + projH / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full block"
      style={{ display: 'block', background: 'rgba(8,8,10,0.7)' }}
      aria-label="Stockpile footprint — top-down plan view"
    >
      <defs>
        <pattern id={patternId} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.6" fill="rgba(255,255,255,0.05)" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${patternId})`} />
      <polygon
        points={polyPts}
        fill="rgba(234,179,8,0.18)"
        stroke="rgba(234,179,8,0.9)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize="7.5"
        fill="rgba(234,179,8,0.9)" fontFamily="monospace" fontWeight="600">
        {`+${meanHeight.toFixed(1)} m`}
      </text>
      <text x={W - 5} y={11} textAnchor="end" fontSize="7"
        fill="rgba(255,255,255,0.22)" fontFamily="monospace">N↑</text>
      <text x={W / 2} y={H - 3} textAnchor="middle" fontSize="5.5"
        fill="rgba(255,255,255,0.18)" fontFamily="monospace" letterSpacing="0.5">
        PLAN VIEW
      </text>
    </svg>
  );
};

const VolumeSubView: React.FC<{
  measurement: MeasurementState;
  projectId: string | null | undefined;
  viewerRef: React.RefObject<CesiumViewer | null>;
}> = ({ measurement, projectId, viewerRef }) => {
  const points = measurement.points;
  const breakdown = measurement.volumeBreakdown;
  const basePlane: VolumeBasePlane = measurement.basePlane ?? 'avg';
  const recomputeVolume = useViewerStore((s) => s.recomputeVolume);
  const openSaveModal = useViewerStore((s) => s.openSaveModalForMeasurement);
  const terrainMode = useViewerStore((s) => s.terrainMode);
  const showMeshPreview = useViewerStore((s) => s.showMeshPreview);
  const setShowMeshPreview = useViewerStore((s) => s.setShowMeshPreview);
  const { data: materialRows = [] } = useMaterials(projectId);
  // BE-A: server-side per-tenant density rows. The card prefers these
  // over the offline LUT so the in-card tonnage estimate matches the
  // numbers the backend processor will use on Save. Resolves to the
  // LUT fallback when the server query hasn't responded yet (or the
  // material isn't in the table).
  const { data: serverDensities } = useMaterialDensities();

  // Material list — server values first, then static fallback. Same
  // pattern as SaveRegionModal for consistency.
  const materials = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of materialRows) {
      if (!row.material || seen.has(row.material)) continue;
      seen.add(row.material);
      out.push(row.material);
    }
    for (const m of FALLBACK_MATERIALS) {
      if (seen.has(m)) continue;
      seen.add(m);
      out.push(m);
    }
    return out;
  }, [materialRows]);

  const [material, setMaterial] = React.useState<string>('unclassified');
  const [recomputing, setRecomputing] = React.useState(false);

  // BE-B: ad-hoc cut/fill compute. The Compare button below stages a
  // workflow_id here; the polling query auto-disables until it's set.
  // Cleared on Clear / unmount via the standard component lifecycle —
  // we don't need to nuke it on tool change because the button is only
  // rendered while the Volume sub-view is mounted.
  const [adhocWorkflowId, setAdhocWorkflowId] = React.useState<string | null>(
    null,
  );
  const submitCompute = useCutFillComputeSubmit();
  const computeStatus = useCutFillComputeStatus(adhocWorkflowId);

  // Resolve current + previous survey ids from the timeline. The
  // canonical ordering is ascending by `survey_date` (see Viewer.tsx:410)
  // so previous = activeIndex - 1, current = activeIndex.
  //
  // We could read from `useCompareStore` if Compare mode is on, but the
  // Volume card's Compare button is a single-shot affordance — operators
  // don't expect it to honour the Compare picker, they expect "newest vs
  // the one before." Honouring Compare's epochA/B too would require an
  // ambiguous fallback rule and we'd surface a different baseline than
  // the dock shows. Keep it timeline-driven and explicit.
  const availableSurveys = useViewerStore((s) => s.availableSurveys);
  const activeSurveyId = useViewerStore((s) => s.activeSurveyId);
  const surveyDate = useMemo(
    () => availableSurveys.find((s) => s.id === activeSurveyId)?.date ?? null,
    [availableSurveys, activeSurveyId],
  );
  const surveyPair = useMemo(() => {
    if (!activeSurveyId) return null;
    const ix = availableSurveys.findIndex((s) => s.id === activeSurveyId);
    if (ix <= 0) return null; // no prior survey to diff against
    return {
      baseline: availableSurveys[ix - 1].id,
      comparison: activeSurveyId,
      baselineLabel: availableSurveys[ix - 1].label,
      comparisonLabel: availableSurveys[ix].label,
    };
  }, [availableSurveys, activeSurveyId]);

  const derived = useMemo(() => {
    if (points.length < 3) return null;
    const carts = pointsToCartesian(points);
    const perimeter = computePerimeterMeters(carts);
    const center = centroidOf(points);
    return { perimeter, center };
  }, [points]);

  const isStillSampling =
    measurement.status === 'drawing' && points.length >= 3;
  const isComplete =
    measurement.status === 'complete' &&
    measurement.volumeCubicMeters !== undefined;

  const handleBasePlaneChange = async (next: VolumeBasePlane) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setRecomputing(true);
    try {
      await recomputeVolume(viewer, { basePlane: next });
    } catch (err) {
      toast.error('Could not recompute volume.', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRecomputing(false);
    }
  };

  const handleSaveAsStockpile = () => {
    if (!projectId) {
      toast.error('Project context missing — cannot save.');
      return;
    }
    if (points.length < 3) return;
    openSaveModal(points, {
      material,
      // Suggest a name that signals this came from the Volume card —
      // the user can overwrite in the modal.
      name: `Stockpile ${new Date().toISOString().slice(5, 16).replace('T', ' ')}`,
    });
  };

  // Build a closed-ring GeoJSON Polygon from the current vertices. Mirrors
  // SaveRegionModal.tsx's serialization so a downloaded file matches what
  // would have been saved to the BE if the operator clicked Save instead.
  const buildInlinePolygon = (): Record<string, unknown> | null => {
    if (points.length < 3) return null;
    const ring: [number, number][] = points.map((v) => [v.longitude, v.latitude]);
    ring.push(ring[0]);
    return { type: 'Polygon', coordinates: [ring] };
  };

  // Auto-generated name + filename base — same pattern as Save-as-stockpile
  // suggestion so the downloaded file is recognisable next to a saved row.
  const inlineName = `Stockpile ${new Date().toISOString().slice(5, 16).replace('T', ' ')}`;
  const inlineSlug = inlineName.toLowerCase().replace(/[^a-z0-9-]+/g, '_').replace(/^_|_$/g, '');

  const onInlineExportGeoJson = () => {
    const geom = buildInlinePolygon();
    if (!geom) return;
    exportMeasurementAsGeoJson(
      {
        id: 'inline',
        name: inlineName,
        feature_type: 'stockpile',
        geojson: geom,
        properties: {
          material,
          area_m2: measurement.areaSquareMeters ?? null,
          volume_m3: measurement.volumeCubicMeters ?? null,
        },
        material_type: material,
        area_m2: measurement.areaSquareMeters ?? null,
        volume_m3: measurement.volumeCubicMeters ?? null,
      },
      `${inlineSlug}.geojson`,
    );
  };

  const onInlineExportCsv = () => {
    const geom = buildInlinePolygon();
    if (!geom) return;
    const row: MeasurementRow = {
      id: 'inline',
      type: 'stockpile',
      name: inlineName,
      project_id: projectId ?? '',
      survey_id: activeSurveyId ?? '',
      coordinates: JSON.stringify((geom as { coordinates: unknown }).coordinates),
      distance_m: null,
      area_m2: measurement.areaSquareMeters ?? null,
      volume_m3: measurement.volumeCubicMeters ?? null,
      created_at: new Date().toISOString(),
    };
    exportMeasurementAsCsv(row, `${inlineSlug}.csv`);
  };

  const onInlineVector = (format: VectorExportFormat) => {
    const geom = buildInlinePolygon();
    if (!geom) {
      toast.error('Draw at least 3 points to export.');
      return;
    }
    const ext = format === 'shp' ? 'zip' : format;
    const filename = `${inlineSlug}.${ext}`;
    const toastId = toast.loading(`Generating ${format.toUpperCase()}…`);
    exportInlineVector(format, geom, inlineName, filename, {
      material,
      area_m2: measurement.areaSquareMeters,
      volume_m3: measurement.volumeCubicMeters,
    })
      .then(() => {
        toast.dismiss(toastId);
        toast.success(`${format.toUpperCase()} downloaded.`);
      })
      .catch(() => {
        toast.dismiss(toastId);
        toast.error(`${format.toUpperCase()} export failed.`);
      });
  };

  const onInlineGeoTiff = (source: RasterExportSource) => {
    const geom = buildInlinePolygon();
    if (!geom) {
      toast.error('Draw at least 3 points to export.');
      return;
    }
    if (!activeSurveyId) {
      toast.error('No active survey — open a survey to clip raster data.');
      return;
    }
    const toastId = toast.loading(`Generating GeoTIFF (${source})…`);
    exportInlineGeoTiff(source, geom, activeSurveyId, inlineName)
      .then(() => {
        toast.dismiss(toastId);
        toast.success(`GeoTIFF (${source}) ready — downloading.`);
      })
      .catch(() => {
        toast.dismiss(toastId);
        toast.error(`GeoTIFF export failed — ${source} raster may be unavailable.`);
      });
  };

  // Resolve the density we should use for the in-card tonnage estimate.
  // Server row wins over LUT; the resolver tags the source so the hint
  // badge can surface provenance. Memoised on `material` + the server
  // payload so a tenant override appearing mid-session re-renders the
  // tonnage live.
  const resolvedDensity = useMemo(
    () => resolveDensity(material, serverDensities, densityFor(material)),
    [material, serverDensities],
  );

  const tonnageEstimate = useMemo(() => {
    if (!isComplete || measurement.volumeCubicMeters === undefined) return null;
    // `estimateTonnage` is a thin wrapper over the LUT-based density —
    // when the server has a row, multiply directly so the override
    // takes effect without falling through the LUT path.
    return measurement.volumeCubicMeters * resolvedDensity.density;
  }, [isComplete, measurement.volumeCubicMeters, resolvedDensity.density]);

  // V-TRUST-01 — propagate terrain RMSE through the sample grid so the
  // headline shows ± X % (95 % CI) alongside the net number. Recomputes
  // live on terrainMode change even when the volume sum itself is still
  // from the prior recompute; operators have asked for an at-a-glance
  // sense of how much slop is in the value, not just High/Med/Low.
  const errorEstimate: VolumeErrorEstimate = useMemo(() => {
    if (!breakdown || !isComplete) return { m3: 0, pct: null };
    return estimateVolumeError({
      sampleCount: breakdown.sampleCount,
      polygonAreaM2: measurement.areaSquareMeters ?? 0,
      netVolM3: breakdown.netVol,
      rmseM: rmseForTerrain(terrainMode),
    });
  }, [breakdown, isComplete, measurement.areaSquareMeters, terrainMode]);

  const provenanceLabel =
    resolvedDensity.source === 'server-client'
      ? 'server (override)'
      : resolvedDensity.source === 'server-default'
        ? 'server (default)'
        : 'LUT';

  const area = measurement.areaSquareMeters ?? 0;
  const meanH = area > 0 && breakdown ? breakdown.netVol / area : 0;

  const handleCompareWithLast = () => {
    if (!projectId) {
      toast.error('Project context missing — cannot compare.');
      return;
    }
    if (!surveyPair) {
      toast.error('No prior survey available — load at least two surveys to compare.');
      return;
    }
    if (points.length < 3) return;

    // Build a single-feature FeatureCollection from the in-progress
    // polygon. The processor accepts bare Geometry / Feature / FC and
    // normalises downstream, but FC is the most explicit shape and
    // matches what `gdal_rasterize` reads natively.
    const ring: [number, number][] = points.map((p) => [p.longitude, p.latitude]);
    // Close the ring — operators draw open polygons; the right-click
    // close gesture doesn't repeat the first vertex in `points`.
    if (
      ring.length > 0 &&
      (ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1])
    ) {
      ring.push([ring[0][0], ring[0][1]]);
    }
    const polygon = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] },
        },
      ],
    } as Record<string, unknown>;

    submitCompute.mutate(
      {
        project_id: projectId,
        baseline_survey_id: surveyPair.baseline,
        comparison_survey_id: surveyPair.comparison,
        polygon_geojson: polygon,
      },
      {
        onSuccess: (data) => {
          setAdhocWorkflowId(data.workflow_id);
          toast.success('Comparing surveys…', {
            description: `${surveyPair.baselineLabel} → ${surveyPair.comparisonLabel}`,
          });
        },
        onError: (err) => {
          toast.error('Could not start comparison.', {
            description: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  };

  // Cut-fill warning — fires when the polygon footprint includes
  // depressions large enough (>5% of fill volume) that the operator
  // should consider redrawing or picking a different base plane.
  const cutFillWarning = useMemo(() => {
    if (!breakdown) return null;
    const total = Math.max(breakdown.fillVol + breakdown.cutVol, 1e-9);
    if (breakdown.cutVol / total > 0.05) {
      return 'Polygon includes depressions — consider redrawing or trying a different base plane.';
    }
    return null;
  }, [breakdown]);

  return (
    <div className="space-y-2">
      {isStillSampling && (
        <div className="rounded-sm border border-border-subtle bg-bg-elevated/40 px-2 py-2 text-[11px] text-text-muted">
          <Mountain className="inline size-3 mr-1.5 align-text-bottom" />
          Sampling the terrain inside the polygon — usually 100–500 ms.
        </div>
      )}

      {isComplete && breakdown && (
        <>
          <KpiGrid
            items={[
              {
                label: 'Net volume',
                value: (
                  <span className="inline-flex flex-col gap-0.5 min-w-0">
                    <strong>{formatVolume(measurement.volumeCubicMeters ?? 0)}</strong>
                    <AccuracyBand error={errorEstimate} terrainMode={terrainMode} />
                  </span>
                ),
                hint: `fillVol − cutVol, reported with a 95% CI derived from ${terrainMode.toUpperCase()} RMSE · √N · cell area`,
              },
              {
                label: 'Tonnage (≈ est.)',
                value: tonnageEstimate !== null ? formatTonnage(tonnageEstimate) : '—',
                hint: `Live estimate · density ${formatDensity(resolvedDensity.density)} · ${provenanceLabel}. Backend recomputes on Save.`,
              },
              {
                label: 'Area',
                value: formatArea(measurement.areaSquareMeters ?? 0),
              },
              {
                label: 'Perimeter',
                value: derived ? formatDistance(derived.perimeter) : '—',
              },
              {
                label: 'Base elevation',
                value: formatElevation(breakdown.baseElevation),
                hint: 'Plane elevation at the polygon centroid (a.s.l.)',
              },
              {
                label: 'Samples',
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    {breakdown.sampleCount}
                    <ConfidenceChip count={breakdown.sampleCount} />
                  </span>
                ),
              },
            ]}
          />

          <ChipRow
            items={[
              {
                label: 'Fill',
                value: formatVolume(breakdown.fillVol),
                tone: 'fill',
              },
              {
                label: 'Cut',
                value: formatVolume(breakdown.cutVol),
                tone: 'cut',
              },
              {
                label: 'Net',
                value: formatVolume(breakdown.netVol),
                tone: 'net',
              },
            ]}
          />

          <SectionLabel icon={<Mountain className="size-3" />} label="Preview" />
          <div className="rounded-sm border border-border-subtle overflow-hidden">
            <StockpileFootprintSVG
              points={points}
              meanHeight={meanH}
            />
            <div className="bg-bg-base/60 px-2 pt-1.5 pb-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-text-muted">Show on map</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showMeshPreview}
                  onClick={() => setShowMeshPreview(!showMeshPreview)}
                  className={cn(
                    'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60',
                    showMeshPreview ? 'bg-accent' : 'bg-bg-elevated',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block size-3 rounded-full bg-white shadow-sm transition-transform',
                      showMeshPreview ? 'translate-x-3' : 'translate-x-0',
                    )}
                  />
                  <span className="sr-only">{showMeshPreview ? 'Hide' : 'Show'} on map</span>
                </button>
              </div>
              <KpiGrid
                items={[
                  {
                    label: 'Base elevation',
                    value: formatElevation(breakdown.baseElevation),
                    hint: 'Base-plane elevation a.s.l.',
                  },
                  {
                    label: 'Mean height',
                    value: formatElevation(meanH),
                    hint: 'Net volume ÷ footprint area',
                  },
                  {
                    label: 'Top elevation',
                    value: formatElevation(breakdown.baseElevation + meanH),
                    hint: 'Base + mean height',
                  },
                ]}
              />
            </div>
          </div>

          {cutFillWarning && (
            <div className="flex items-start gap-1.5 rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-200">
              <AlertTriangle className="size-3 mt-0.5 shrink-0" />
              <span>{cutFillWarning}</span>
            </div>
          )}

          {/* Material + base-plane controls — these drive recomputation
              of the headline number live in the card. */}
          <div className="rounded-sm border border-border-subtle bg-bg-base/60 p-2 space-y-2">
            <div className="space-y-1">
              <label
                htmlFor="vol-material"
                className="block text-[9px] uppercase tracking-[0.12em] text-text-muted"
              >
                Material (drives tonnage estimate)
              </label>
              <select
                id="vol-material"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="h-7 w-full rounded-sm border border-border-subtle bg-bg-elevated px-2 text-[11px] text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
              >
                {materials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-text-muted">
                <Scale className="inline size-3 mr-1 align-text-bottom" />
                Density: {formatDensity(resolvedDensity.density)} ·{' '}
                <span
                  className={
                    resolvedDensity.source === 'server-client'
                      ? 'text-accent'
                      : undefined
                  }
                >
                  {provenanceLabel}
                </span>{' '}
                · estimate only — backend recomputes on Save.
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="vol-baseplane"
                className="block text-[9px] uppercase tracking-[0.12em] text-text-muted"
              >
                Base plane method
              </label>
              <select
                id="vol-baseplane"
                value={basePlane}
                disabled={recomputing}
                onChange={(e) =>
                  handleBasePlaneChange(e.target.value as VolumeBasePlane)
                }
                className="h-7 w-full rounded-sm border border-border-subtle bg-bg-elevated px-2 text-[11px] text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 disabled:opacity-50"
              >
                <option value="avg" title="Use for uniform flat ground (default).">Average vertex elevation</option>
                <option value="min" title="Use for containment volume (lowest vertex as reference).">Minimum vertex (conservative fill)</option>
                <option value="max" title="Use for deficit / cut-volume below a peak.">Maximum vertex (conservative cut)</option>
                <option value="fitted" title="Use for tilted pads or sloped stockpiles.">Fitted plane (least-squares)</option>
              </select>
              {/* V-TRUST-03 — inline hint that changes with selection so
                  the guidance is always visible, not just on hover. */}
              <p className="text-[10px] text-text-muted leading-snug">
                {basePlane === 'avg' && 'Use for uniform flat ground (default).'}
                {basePlane === 'min' && 'Use for containment volume (lowest vertex as reference).'}
                {basePlane === 'max' && 'Use for deficit / cut-volume below a peak.'}
                {basePlane === 'fitted' && 'Use for tilted pads or sloped stockpiles.'}
              </p>
              {recomputing && (
                <p className="text-[10px] text-text-muted">Recomputing…</p>
              )}
            </div>
          </div>

          {derived?.center && (
            <div className="rounded-sm border border-border-subtle bg-bg-base/60 p-2">
              <div className="mb-1 text-[9px] uppercase tracking-[0.12em] text-text-muted">
                Centroid
              </div>
              <KpiGrid
                items={[
                  { label: 'Lat', value: formatLatLng(derived.center.latitude) },
                  { label: 'Lng', value: formatLatLng(derived.center.longitude) },
                  { label: 'Elev', value: formatElevation(derived.center.height) },
                ]}
              />
            </div>
          )}

          {/* BE-B: ad-hoc cut/fill compute result. Renders below the
              KPI grid so the live volume estimate stays the headline
              number; the diff result is auxiliary context. The whole
              block is conditional on the operator having clicked
              Compare — otherwise it's invisible. */}
          {adhocWorkflowId && (
            <CutFillCompareResult
              status={computeStatus.data}
              isFetching={computeStatus.isFetching}
              isError={computeStatus.isError}
              fetchError={computeStatus.error}
              onDismiss={() => setAdhocWorkflowId(null)}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveAsStockpile}
              className="inline-flex items-center gap-1.5 rounded-sm border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-accent hover:bg-accent/20 transition-colors"
            >
              <Save className="size-3" /> Save as stockpile
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    title="Download this stockpile in a GIS-friendly format"
                    className="inline-flex items-center gap-1.5 rounded-sm border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-accent hover:bg-accent/20 transition-colors"
                  >
                    <Download className="size-3" /> Download
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="bg-card border-border-subtle w-52">
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={onInlineExportGeoJson}
                >
                  Export GeoJSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={onInlineExportCsv}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={() => onInlineVector('shp')}
                >
                  Shapefile (.zip)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={() => onInlineVector('kml')}
                >
                  KML
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={() => onInlineVector('kmz')}
                >
                  KMZ
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  onClick={() => onInlineVector('dxf')}
                >
                  DXF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  disabled={!activeSurveyId}
                  onClick={() => onInlineGeoTiff('ortho')}
                >
                  GeoTIFF — Ortho clip
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  disabled={!activeSurveyId}
                  onClick={() => onInlineGeoTiff('dsm')}
                >
                  GeoTIFF — DSM clip
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[11px] uppercase tracking-[0.12em]"
                  disabled={!activeSurveyId}
                  onClick={() => onInlineGeoTiff('dtm')}
                >
                  GeoTIFF — DTM clip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={handleCompareWithLast}
              disabled={
                !surveyPair ||
                submitCompute.isPending ||
                (!!adhocWorkflowId &&
                  computeStatus.data?.status !== 'complete' &&
                  computeStatus.data?.status !== 'failed')
              }
              title={
                surveyPair
                  ? `Diff ${surveyPair.baselineLabel} → ${surveyPair.comparisonLabel} inside this polygon.`
                  : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-sm border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-accent hover:bg-accent/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent/10"
            >
              <LayersIcon className="size-3" />
              {submitCompute.isPending
                ? 'Submitting…'
                : adhocWorkflowId &&
                  computeStatus.data?.status !== 'complete' &&
                  computeStatus.data?.status !== 'failed'
                  ? 'Computing…'
                  : 'Compare with last survey'}
            </button>
          </div>

          {/* V-COMPARE-01 — inline empty-state replaces the hover-only
              `title` tooltip that operators kept missing. When the
              project has a single survey the compare button is useless,
              so we tell the user what to do instead of leaving them
              guessing. Stays hidden once a second survey lands. */}
          {!surveyPair && (
            <div className="rounded-sm border border-border-subtle bg-bg-elevated/40 px-2 py-1.5 text-[11px] text-text-muted">
              <LayersIcon className="inline size-3 mr-1.5 align-text-bottom" />
              Upload or switch to a second survey on the timeline to enable comparison.
            </div>
          )}

          <ProvenanceFooter
            terrainMode={terrainMode}
            basePlane={basePlane}
            surveyDate={surveyDate}
            computedAtEpochMs={measurement.computedAt ?? null}
          />
        </>
      )}
    </div>
  );
};

/**
 * BE-B compare-result panel. Shown only when the operator has clicked
 * "Compare with last survey" and a workflow_id has been staged in the
 * VolumeSubView. Three states:
 *
 *   queued / processing → spinner + "Computing diff…"
 *   complete            → cut / fill / net chips + sample count + diff
 *                         raster URL surfaced as a tiny "open raster"
 *                         affordance (no inline tile preview yet — the
 *                         HeatmapLegend mount happens on the global
 *                         CompareDock; an inline preview is a follow-up)
 *   failed              → red error chip with the processor's message
 *
 * The dismiss button clears the workflow_id and tears down the polling
 * query — the row stays in the DB for ops to inspect.
 */
const CutFillCompareResult: React.FC<{
  status: import('@/hooks/useCutFillCompute').CutFillComputeRow | undefined;
  isFetching: boolean;
  isError: boolean;
  fetchError: Error | null;
  onDismiss: () => void;
}> = ({ status, isFetching, isError, fetchError, onDismiss }) => {
  const phase = status?.status ?? (isFetching ? 'queued' : 'queued');
  const isTerminal = phase === 'complete' || phase === 'failed';

  return (
    <div className="rounded-sm border border-accent/30 bg-accent/[0.06] p-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-accent">
          <LayersIcon className="size-3" />
          Survey comparison
          {!isTerminal && (
            <span className="ml-1 text-text-muted normal-case tracking-normal">
              · {phase === 'processing' ? 'computing' : 'queued'}
            </span>
          )}
        </div>
        {isTerminal && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label="Dismiss comparison result"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {isError && (
        <div className="flex items-start gap-1.5 text-[10px] text-rose-300">
          <AlertTriangle className="size-3 mt-0.5 shrink-0" />
          <span>
            Status check failed: {fetchError?.message ?? 'unknown error'}
          </span>
        </div>
      )}

      {!isTerminal && (
        <p className="text-[10px] text-text-muted">
          Diffing the two DSMs inside this polygon. Typically 5–15 s.
        </p>
      )}

      {phase === 'failed' && (
        <div className="flex items-start gap-1.5 text-[10px] text-rose-300">
          <AlertTriangle className="size-3 mt-0.5 shrink-0" />
          <span>{status?.error ?? 'Processor reported a failure.'}</span>
        </div>
      )}

      {phase === 'complete' && status && (
        <>
          {/* Cut-Fill Quality Gate Addendum: render the gate's verdict
              before the KPI chips so the operator reads "these numbers may
              be unreliable" before reading the numbers themselves. The
              `opacity-60` wrap below mutes the ChipRow visually without
              touching ChipRow's API for one caller. */}
          {status.quality_suspect && (
            <div
              role="alert"
              title={status.quality_reason}
              className="flex items-start gap-1.5 rounded-sm border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-300"
            >
              <AlertTriangle className="size-3 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold uppercase tracking-[0.12em]">
                  Suspect
                </span>
                <span className="ml-1 text-text-muted">
                  — {status.quality_reason_code === 'datum_mismatch'
                    ? 'vertical datum mismatch'
                    : status.quality_reason_code === 'extreme_depth'
                      ? 'implausible effective depth'
                      : 'data quality issue'}
                </span>
              </div>
            </div>
          )}
          <div className={cn(status.quality_suspect && 'opacity-60')}>
            <ChipRow
              items={[
                {
                  label: 'Cut',
                  value: formatVolume(status.cut_volume_m3 ?? 0),
                  tone: 'cut',
                },
                {
                  label: 'Fill',
                  value: formatVolume(status.fill_volume_m3 ?? 0),
                  tone: 'fill',
                },
                {
                  label: 'Net',
                  value: formatVolume(status.net_change_m3 ?? 0),
                  tone: 'net',
                },
              ]}
            />
          </div>
          <p className="text-[10px] text-text-muted">
            {status.sample_count ?? 0} pixels integrated · baseline {status.baseline_survey_id.slice(0, 8)}… → comparison {status.comparison_survey_id.slice(0, 8)}…
          </p>
          {status.diff_raster_url && (
            <a
              href={status.diff_raster_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
            >
              <ArrowUpRight className="size-3" /> diff raster
            </a>
          )}
        </>
      )}
    </div>
  );
};

const ConfidenceChip: React.FC<{ count: number }> = ({ count }) => {
  const c = confidenceFor(count);
  const cls =
    c.tone === 'high'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : c.tone === 'med'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-rose-500/15 text-rose-300 border-rose-500/30';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border px-1 py-px text-[9px] uppercase tracking-[0.1em]',
        cls,
      )}
    >
      {c.label}
    </span>
  );
};

/** V-TRUST-01 — quantified accuracy band rendered beneath the Net volume
 *  headline. Falls back to an m³ width when netVol is ~0 (pct would
 *  blow up). The chip colour comes from the same tier mapping that
 *  drives the sample-count ConfidenceChip so the two stay coherent. */
const AccuracyBand: React.FC<{
  error: VolumeErrorEstimate;
  terrainMode: 'dtm' | 'dsm';
}> = ({ error, terrainMode }) => {
  if (error.m3 <= 0) return null;
  const tone = toneForErrorPct(error.pct);
  const cls =
    tone === 'high'
      ? 'text-emerald-300'
      : tone === 'med'
        ? 'text-amber-300'
        : 'text-rose-300';
  const label =
    error.pct !== null
      ? `± ${error.pct.toFixed(1)}% (95% CI)`
      : `± ${formatVolume(error.m3)} (95% CI)`;
  return (
    <span
      className={cn('text-[9px] uppercase tracking-[0.12em] font-mono', cls)}
      title={`${terrainMode.toUpperCase()} terrain RMSE · propagated through the sample grid`}
    >
      {label}
    </span>
  );
};

const ProfileSubView: React.FC<{
  samples: ProfileSample[];
  mode: 'profile' | 'cross-section';
  viewerRef: React.RefObject<CesiumViewer | null>;
}> = ({ samples, mode, viewerRef }) => {
  const metrics = useMemo(() => computeProfileMetrics(samples), [samples]);
  const benchCount = useMemo(
    () => (mode === 'cross-section' ? countBenchExtrema(samples, 0.5) : null),
    [mode, samples],
  );
  void viewerRef;

  return (
    <div className="space-y-2">
      <KpiGrid
        items={[
          {
            label: 'Total distance',
            value: <strong>{formatDistance(metrics.totalDistance)}</strong>,
          },
          {
            label: 'Δ elevation',
            value: formatElevation(metrics.maxHeight - metrics.minHeight),
          },
          { label: 'Min', value: formatElevation(metrics.minHeight) },
          { label: 'Max', value: formatElevation(metrics.maxHeight) },
          { label: 'Mean', value: formatElevation(metrics.meanHeight) },
          {
            label: 'Avg grade',
            value: (
              <span
                className={cn(
                  metrics.avgGradePct > 0 && 'text-emerald-300',
                  metrics.avgGradePct < 0 && 'text-rose-300',
                )}
              >
                {formatGradePct(metrics.avgGradePct)}
              </span>
            ),
            hint: 'Net slope from first to last sample (sign preserved)',
          },
        ]}
      />

      <ChipRow
        items={[
          {
            label: 'Gain',
            value: formatElevation(metrics.elevationGain),
            tone: 'fill',
          },
          {
            label: 'Loss',
            value: formatElevation(metrics.elevationLoss),
            tone: 'cut',
          },
          {
            label: 'Max grade',
            value: formatGradePct(metrics.maxGradePct),
            tone: 'net',
          },
          ...(benchCount !== null
            ? [{ label: 'Benches', value: benchCount.toString() }]
            : []),
        ]}
      />

      <div className="rounded-sm border border-border-subtle bg-bg-base/60 p-2 text-[10px] text-text-muted leading-snug">
        <TrendingUp className="inline size-3 text-emerald-300 mr-1 align-text-bottom" />
        Gain accumulates positive segment deltas;{' '}
        <TrendingDown className="inline size-3 text-rose-300 mx-1 align-text-bottom" />
        loss the negative ones. Max grade is the steepest segment.
      </div>

    </div>
  );
};

/* ─────────────────────── lens stats sub-view ─────────────────────── */

/** Format degrees with one decimal + degree sign. */
function fmtDeg(v: number): string {
  return `${v.toFixed(1)}°`;
}

/** Compass direction with degree (e.g., "SW (212°)"). */
function fmtCompass(bearing: number, label: string): string {
  return `${label} (${Math.round(bearing)}°)`;
}

const LensStatsSubView: React.FC<{
  /** Called when the user clicks a "Show <lens> on map" radio for the
   *  first time on a polygon that didn't include rasters in its
   *  original request — triggers a re-fetch with include_rasters:true
   *  so the PNGs are populated. */
  onRequestRasters: () => void;
}> = ({ onRequestRasters }) => {
  const lensStats = useViewerStore((s) => s.lensStats);
  const setLensRasterChoice = useViewerStore((s) => s.setLensRasterChoice);
  const { status, result, error, rasterChoice } = lensStats;

  // The card defaults rasterChoice to null. When the user picks a
  // lens via radio, we either swap to the already-loaded PNG (cheap)
  // or fire a request to fetch the rasters (slow path).
  const hasRasters = !!(result?.slope_png_b64 && result?.aspect_png_b64 && result?.flow_png_b64);

  const handleRasterPick = (next: 'slope' | 'aspect' | 'flow' | null) => {
    setLensRasterChoice(next);
    if (next && !hasRasters) onRequestRasters();
  };

  if (status === 'computing') {
    return (
      <div className="text-xs text-text-muted py-2">
        Computing slope / aspect / flow from DSM…
        <div className="text-[10px] text-text-muted/70 mt-0.5">
          First polygon on a survey takes ~3s (DSM download); subsequent are &lt;1s.
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-xs text-danger py-2">
        Compute failed: {error}
      </div>
    );
  }

  if (status !== 'complete' || !result) {
    return (
      <div className="text-xs text-text-muted py-2">
        Pick &quot;Lens stats&quot; after drawing a polygon to compute slope, aspect, and flow.
      </div>
    );
  }

  const confidence =
    result.sample_count >= 1000
      ? 'High'
      : result.sample_count >= 200
        ? 'Medium'
        : 'Low';

  return (
    <div className="space-y-3">
      {/* Show-on-map radio. None = numbers only; picking slope/aspect/flow
          places the colored PNG over the polygon as a Cesium imagery
          layer via useLensStatsRasterLayer. First pick on a polygon that
          didn't fetch rasters triggers a re-fetch (slow path ~3s); after
          that, swapping radios is instant because all 3 PNGs are cached. */}
      <div className="rounded-sm border border-border-subtle bg-bg-elevated/40 p-2">
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1.5">
          Show on map
        </div>
        <div className="flex gap-1.5 text-[11px]">
          {(
            [
              { key: null, label: 'None' },
              { key: 'slope', label: 'Slope' },
              { key: 'aspect', label: 'Aspect' },
              { key: 'flow', label: 'Flow' },
            ] as const
          ).map(({ key, label }) => {
            const active = rasterChoice === key;
            return (
              <button
                key={String(key)}
                type="button"
                onClick={() => handleRasterPick(key)}
                className={
                  active
                    ? 'h-6 px-2 rounded-sm bg-accent text-bg-base text-[10px] font-medium'
                    : 'h-6 px-2 rounded-sm border border-border-subtle bg-bg-elevated text-text-muted text-[10px] hover:text-text-primary'
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        {rasterChoice && !hasRasters && status === 'complete' && (
          <div className="text-[9px] text-text-muted mt-1">
            Loading raster overlay…
          </div>
        )}
      </div>

      {/* Slope */}
      <div className="rounded-sm border border-border-subtle bg-bg-elevated/40 p-2">
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1.5">
          Slope (from horizontal)
        </div>
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          <Stat label="AVG" value={fmtDeg(result.slope.mean)} />
          <Stat label="MIN" value={fmtDeg(result.slope.min)} />
          <Stat label="MAX" value={fmtDeg(result.slope.max)} />
          <Stat label="SD" value={fmtDeg(result.slope.stddev)} />
        </div>
      </div>

      {/* Aspect */}
      <div className="rounded-sm border border-border-subtle bg-bg-elevated/40 p-2">
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1.5">
          Aspect (compass bearing of downhill)
        </div>
        <div className="flex items-baseline justify-between text-[11px]">
          <div>
            <div className="text-text-muted text-[9px]">DOMINANT</div>
            <div className="text-text-primary text-sm font-medium">
              {fmtCompass(result.aspect_mean_deg, result.aspect_dominant)}
            </div>
          </div>
          <div className="text-text-muted text-[10px] text-right">
            range {fmtDeg(result.aspect.min)} – {fmtDeg(result.aspect.max)}
          </div>
        </div>
        {/* Histogram bar */}
        <div className="mt-2 flex gap-0.5">
          {(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const).map((dir) => {
            const total = Object.values(result.aspect_histogram).reduce(
              (a, b) => a + b,
              0,
            );
            const count = result.aspect_histogram[dir] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={dir} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="h-8 w-full bg-bg-surface rounded-sm relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-accent/60"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <div className="text-[8px] text-text-muted">{dir}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flow / TRI */}
      <div className="rounded-sm border border-border-subtle bg-bg-elevated/40 p-2">
        <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted mb-1.5">
          Flow (Terrain Ruggedness Index, m)
        </div>
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          <Stat label="AVG" value={result.flow.mean.toFixed(2)} />
          <Stat label="MIN" value={result.flow.min.toFixed(2)} />
          <Stat label="MAX" value={result.flow.max.toFixed(2)} />
          <Stat label="SD" value={result.flow.stddev.toFixed(2)} />
        </div>
        {result.flow.max > 5 && (
          <div className="text-[10px] text-text-muted mt-1.5">
            High peak ruggedness — likely drainage / cliff edge inside polygon.
          </div>
        )}
      </div>

      {/* Footer: provenance */}
      <div className="flex items-center justify-between text-[10px] text-text-muted pt-1">
        <span>
          {result.sample_count.toLocaleString()} samples · {(result.area_m2 / 10000).toFixed(2)} ha
        </span>
        <span className={confidence === 'High' ? 'text-success' : confidence === 'Medium' ? 'text-warning' : 'text-danger'}>
          {confidence} confidence
        </span>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[9px] uppercase tracking-wider text-text-muted">{label}</span>
    <span className="text-text-primary font-medium">{value}</span>
  </div>
);

/* ─────────────────────── card shell ─────────────────────── */

// Icon + title derived from the active measurement tool.
const TOOL_META: Record<string, { icon: React.ReactNode; label: string }> = {
  distance: { icon: <Ruler className="size-4" />, label: 'Distance' },
  area: { icon: <Square className="size-4" />, label: 'Area' },
  volume: { icon: <Hexagon className="size-4" />, label: 'Volume' },
  profile: { icon: <Mountain className="size-4" />, label: 'Profile' },
  'cross-section': { icon: <Mountain className="size-4" />, label: 'Cross-section' },
  'lens-stats': { icon: <Compass className="size-4" />, label: 'Lens stats' },
};

/** Data-view dropdown options for the inspector card. */
const DATA_VIEW_OPTIONS: { value: InspectorDataView; label: string }[] = [
  { value: 'distance', label: 'Distance' },
  { value: 'area', label: 'Area' },
  { value: 'volume', label: 'Volume' },
  { value: 'profile', label: 'Profile' },
  { value: 'cross-section', label: 'Cross-section' },
  { value: 'lens-stats', label: 'Lens stats (slope/aspect/flow)' },
];

export const MeasurementResultsCard: React.FC<Props> = ({
  projectId,
  viewerRef,
}) => {
  const measurement = useViewerStore((s) => s.measurement);
  const profile = useViewerStore((s) => s.profile);
  const clearMeasurement = useViewerStore((s) => s.clearMeasurement);
  const clearProfile = useViewerStore((s) => s.clearProfile);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const inspectorDataView = useViewerStore((s) => s.inspectorDataView);
  const setInspectorDataView = useViewerStore((s) => s.setInspectorDataView);
  const setMeasurement = useViewerStore((s) => s.setMeasurement);
  const recomputeVolume = useViewerStore((s) => s.recomputeVolume);
  const setProfileSamples = useViewerStore((s) => s.setProfileSamples);
  const manifestSurveyId = useViewerStore((s) => s.manifest?.surveyId ?? null);
  const lensStats = useViewerStore((s) => s.lensStats);
  const setLensStatsStatus = useViewerStore((s) => s.setLensStatsStatus);
  const setLensStatsResult = useViewerStore((s) => s.setLensStatsResult);
  const clearLensStats = useViewerStore((s) => s.clearLensStats);

  const tool = measurement.tool;
  const hasMeasurement =
    tool !== null && measurement.status !== 'idle' && measurement.points.length > 0;
  const hasProfile = profile.samples !== null && profile.samples.length >= 2;
  const hasLensStats =
    lensStats.status === 'computing' ||
    lensStats.status === 'error' ||
    (lensStats.status === 'complete' && lensStats.result !== null);

  if (!hasMeasurement && !hasProfile && !hasLensStats) return null;

  const handleClear = () => {
    clearMeasurement();
    clearProfile();
    // Lens-stats result and raster overlay belong to the cleared polygon,
    // so they have to go with it. Without this the SingleTileImageryProvider
    // in useLensStatsRasterLayer keeps rendering the gradient over an empty
    // area, and the card itself stays mounted because hasLensStats is still
    // true (clear measurement → polygon gone, but result.slope_png_b64
    // still alive → card sticks around showing stale numbers).
    clearLensStats();
    setActiveTool('select');
  };

  /** The dropdown is a *display* toggle for most views — it controls
   *  which sub-view renders without touching the drawn geometry.
   *
   *  Exceptions that need activeTool changes:
   *    • Volume  — triggers terrain sampling (computeVolumeFromTerrain)
   *    • Profile / Cross-section — activates useProfileHandler which
   *      sets up the polyline drawing + terrain sampling pipeline */
  const handleDataViewChange = async (next: InspectorDataView) => {
    setInspectorDataView(next);

    // Volume: seed measurement as volume tool and run terrain sampling.
    if (
      next === 'volume' &&
      hasMeasurement &&
      measurement.points.length >= 3 &&
      measurement.tool !== 'volume'
    ) {
      const points = measurement.points;
      const area = measurement.areaSquareMeters;
      setMeasurement({
        tool: 'volume',
        status: 'complete',
        points,
        areaSquareMeters: area,
      });
      const viewer = viewerRef.current;
      if (viewer) {
        toast.info('Computing volume from terrain…');
        setTimeout(async () => {
          try {
            await recomputeVolume(viewer, { basePlane: 'avg' });
          } catch (err) {
            toast.error('Could not compute volume.', {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }, 0);
      }
      return;
    }

    // Profile / Cross-section: sample terrain along the existing drawn
    // line points directly, without changing activeTool (which would
    // reset the drawing). Write results to profile.samples so the
    // ProfileSubView renders immediately.
    if (next === 'profile' || next === 'cross-section') {
      if (hasMeasurement && measurement.points.length >= 2) {
        const viewer = viewerRef.current;
        if (viewer) {
          const carts = measurement.points.map((p) =>
            Cartesian3.fromDegrees(p.longitude, p.latitude, p.height),
          );
          toast.info(`Sampling terrain for ${next === 'cross-section' ? 'cross-section' : 'profile'}…`);
          try {
            const samples = await sampleTerrainAlongPolyline(viewer, carts, 200);
            if (samples.length > 0) {
              setProfileSamples(samples, next === 'cross-section' ? 'cross-section' : 'profile');
            }
          } catch (err) {
            toast.error('Could not sample terrain.', {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
      return;
    }

    // Lens stats: send the drawn polygon to the rendering-engine-be
    // compute endpoint. Requires ≥3 vertices (polygon, not line) and a
    // resolved manifest survey id (so the BE can pick the right DSM).
    // The compute is synchronous — typical latency 1–3s on the cold
    // path (DSM download), <500ms on the cached path.
    if (next === 'lens-stats') {
      if (!hasMeasurement || measurement.points.length < 3) {
        toast.info('Draw a polygon (≥3 vertices) first, then switch to Lens stats.');
        return;
      }
      if (!manifestSurveyId) {
        toast.error('Survey not loaded yet — wait for the manifest.');
        return;
      }
      const polygon: GeoJSON.Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            ...measurement.points.map((p) => [p.longitude, p.latitude] as [number, number]),
            // Close the ring with the first vertex so GDAL doesn't
            // reject it as an open LineString.
            [measurement.points[0].longitude, measurement.points[0].latitude],
          ],
        ],
      };
      setLensStatsStatus('computing');
      try {
        const result = await computeLensStats(manifestSurveyId, polygon);
        setLensStatsResult(result, manifestSurveyId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLensStatsStatus('error', msg);
        toast.error('Lens-stats compute failed.', { description: msg });
      }
      return;
    }

    // Clearing lens stats when navigating away keeps the card from
    // flashing the previous polygon's numbers on a new measurement.
    if (lensStats.status !== 'idle') clearLensStats();

    // If navigating AWAY from profile/cross-section, clear the profile data
    // so the ProfileChart modal closes.
    clearProfile();
  };

  // Build unified subtitle: live status hint for the primary tool.
  const subtitle = (() => {
    if (hasMeasurement) {
      const pts = measurement.points.length;
      if (tool === 'distance') {
        return measurement.status === 'complete'
          ? `${pts} vertices · ${Math.max(pts - 1, 0)} segments`
          : 'Click to add vertices · right-click to finish';
      }
      if (tool === 'area') {
        return measurement.status === 'complete'
          ? `${pts} vertices · footprint locked`
          : 'Click to add vertices · right-click to close';
      }
      if (tool === 'volume') {
        return measurement.status === 'drawing' && pts >= 3
          ? 'Sampling terrain…'
          : measurement.status === 'complete'
            ? `${pts} vertices · ${measurement.volumeBreakdown?.sampleCount ?? 0} samples`
            : 'Draw a polygon and right-click to compute';
      }
    }
    if (hasProfile) return `${profile.samples!.length} samples`;
    return undefined;
  })();

  // Unified icon: use the data-view icon, or Compass fallback.
  const activeMeta =
    TOOL_META[inspectorDataView] ??
    (hasProfile ? TOOL_META[profile.mode] : null) ?? { icon: <Compass className="size-4" />, label: 'Measurements' };

  return (
    <div className="rounded-sm border border-accent/30 bg-accent/[0.06] p-3 space-y-3">
      {/* Header + data view dropdown */}
      <CardHeader
        icon={activeMeta.icon}
        title={activeMeta.label}
        subtitle={subtitle}
        onClear={handleClear}
      />

      {/* Data view selector dropdown */}
      <div className="space-y-1">
        <label
          htmlFor="inspector-data-view"
          className="block text-[9px] uppercase tracking-[0.12em] text-text-muted"
        >
          Data view
        </label>
        <select
          id="inspector-data-view"
          value={inspectorDataView}
          onChange={(e) => handleDataViewChange(e.target.value as InspectorDataView)}
          className="h-7 w-full rounded-sm border border-border-subtle bg-bg-elevated px-2 text-[11px] text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
        >
          {DATA_VIEW_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sub-views rendered based on inspectorDataView */}
      {hasMeasurement && inspectorDataView === 'distance' && (
        <DistanceSubView measurement={measurement} />
      )}

      {hasMeasurement && inspectorDataView === 'area' && (
        <AreaSubView measurement={measurement} />
      )}

      {hasMeasurement && inspectorDataView === 'volume' && (
        <VolumeSubView
          measurement={measurement}
          projectId={projectId}
          viewerRef={viewerRef}
        />
      )}

      {(inspectorDataView === 'profile' || inspectorDataView === 'cross-section') && hasProfile && profile.samples && (
        <ProfileSubView
          samples={profile.samples}
          mode={inspectorDataView === 'cross-section' ? 'cross-section' : 'profile'}
          viewerRef={viewerRef}
        />
      )}

      {inspectorDataView === 'lens-stats' && (
        <LensStatsSubView
          onRequestRasters={async () => {
            // User picked a raster but the previous compute returned
            // numbers-only. Refire the API with include_rasters:true so
            // the PNGs land in the same store slice.
            if (!hasMeasurement || measurement.points.length < 3) return;
            if (!manifestSurveyId) return;
            const polygon: GeoJSON.Polygon = {
              type: 'Polygon',
              coordinates: [
                [
                  ...measurement.points.map((p) => [p.longitude, p.latitude] as [number, number]),
                  [measurement.points[0].longitude, measurement.points[0].latitude],
                ],
              ],
            };
            setLensStatsStatus('computing');
            try {
              const result = await computeLensStats(manifestSurveyId, polygon, { includeRasters: true });
              setLensStatsResult(result, manifestSurveyId);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              setLensStatsStatus('error', msg);
              toast.error('Lens-stats raster fetch failed.', { description: msg });
            }
          }}
        />
      )}
    </div>
  );
};
