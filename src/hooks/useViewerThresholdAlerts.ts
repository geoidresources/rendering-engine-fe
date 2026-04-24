/**
 * V-TASK-05 — In-scene threshold alerts.
 *
 * Evaluates each saved-region's volume against tenant thresholds and
 * returns a map of region-id → breach info so the viewer can render
 * a visual cue (pulsing border on the saved-region card, tooltip).
 *
 * This is a pure data hook — rendering is handled by the card UI.
 * We intentionally avoid any Cesium primitive mutation here because
 * the region polygons are already owned by the Cesium datasource;
 * adding a second entity path would create ordering conflicts.
 */
import { useMemo } from 'react';
import { useThresholds } from '@/hooks/useReconciliation';
import { useMeasurementsList } from '@/hooks/useMeasurementsCrud';

export interface ThresholdBreach {
  regionId: string;
  severity: 'amber' | 'red';
  volumeM3: number;
  thresholdPct: number;
  detectedAt: string;
}

export function useViewerThresholdAlerts(projectId: string | undefined) {
  const { data: thresholds = [] } = useThresholds();
  const { data: regions = [] } = useMeasurementsList(projectId);

  const breaches = useMemo<Record<string, ThresholdBreach>>(() => {
    if (!thresholds.length || !regions.length) return {};

    // Pick the reconciliation threshold row (the primary metric for stockpile alerts).
    const threshold = thresholds.find((t) => t.metric_type === 'reconciliation') ?? thresholds[0];
    if (!threshold) return {};

    const result: Record<string, ThresholdBreach> = {};
    for (const region of regions) {
      const props = region.properties ?? {};
      const vol = props['volume_m3'] as number | undefined;
      if (vol == null || vol <= 0) continue;

      // Simplified breach check: treat `amber_upper_pct` as the amber ceiling.
      // Real reconciliation computes a % deviation; here we use the volume
      // magnitude as a proxy (large piles → more prominent alert).
      // Replaced with reconciliation-deviation once we have period data.
      const maxAmber = threshold.amber_upper_pct;
      const maxGreen = threshold.green_upper_pct;

      // Heuristic: flag regions whose tonnage per m² exceeds the amber or red
      // threshold as a proportion of the maximum in the project. This is a
      // intentional simplification for the first in-scene alert — V-TRUST-06
      // will replace this with actual recompute-derived deviation.
      const tons = props['tonnage'] as number | undefined;
      if (tons == null) continue;
      const totalTons = regions.reduce((s, r) => s + ((r.properties?.['tonnage'] as number | undefined) ?? 0), 0);
      if (totalTons <= 0) continue;
      const sharePct = (tons / totalTons) * 100;

      if (sharePct > maxAmber) {
        result[region.id] = {
          regionId: region.id,
          severity: 'red',
          volumeM3: vol,
          thresholdPct: maxAmber,
          detectedAt: region.updated_at,
        };
      } else if (sharePct > maxGreen) {
        result[region.id] = {
          regionId: region.id,
          severity: 'amber',
          volumeM3: vol,
          thresholdPct: maxGreen,
          detectedAt: region.updated_at,
        };
      }
    }
    return result;
  }, [thresholds, regions]);

  return breaches;
}
