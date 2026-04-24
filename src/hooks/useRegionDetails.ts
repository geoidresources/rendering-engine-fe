/**
 * useRegionDetails — merges measurement geometry + stockpile analytics
 * into a single data object for the RegionDetailCard in the Inspector tab.
 *
 * Data sources (in priority order):
 *  1. `useMeasurementsList` — full `MeasurementResponse` with GeoJSON ring +
 *     raw `properties` written by the workflow processor (rms_error, etc.)
 *  2. `useStockpiles(surveyId)` — computed StockpileRecord (volume, tonnage,
 *     delta) keyed on `pile_id === measurement.id`
 *
 * Matching: the clicked `selectedFeature` may carry a stable `id` field (if
 * the GeoJSON was created by the Draw tool, the server assigns a UUID and the
 * loader stores it in entity properties) or a `name` string. We try `id`
 * first; fall back to case-insensitive name match so legacy regions that
 * didn't surface their UUID still resolve.
 */

import { useMemo } from 'react';
import type { MeasurementResponse } from './useMeasurementsCrud';
import { useMeasurementsList } from './useMeasurementsCrud';
import { useStockpiles } from './useAnalytics';
import type { StockpileRecord } from '@/types/api';

export interface RegionDetails {
  /** The matched server-side measurement (geometry + saved properties). */
  measurement: MeasurementResponse | null;
  /** Computed analytics from the stockpile pipeline, if available. */
  stockpile: StockpileRecord | null;
  /** Parsed GeoJSON polygon outer ring — `[lng, lat][]` ready for SVG. */
  ring: [number, number][] | null;
  isLoading: boolean;
}

/**
 * @param feature  The raw `selectedFeature` from viewerStore. May be null.
 * @param projectId  Active project — scopes the measurement list query.
 * @param surveyId   Active survey — scopes the stockpile analytics query.
 */
export function useRegionDetails(
  feature: Record<string, unknown> | null,
  projectId: string | null | undefined,
  surveyId: string | null | undefined,
): RegionDetails {
  const { data: measurements = [], isLoading: measurementsLoading } =
    useMeasurementsList(projectId);
  const { data: stockpiles = [], isLoading: stockpilesLoading } =
    useStockpiles(surveyId ?? '');

  const result = useMemo<RegionDetails>(() => {
    if (!feature) {
      return { measurement: null, stockpile: null, ring: null, isLoading: false };
    }

    // ── Match measurement ─────────────────────────────────────────────
    const featureId = String(feature.id ?? feature._entityId ?? '');
    const featureName = String(feature.name ?? '').toLowerCase();

    let measurement: MeasurementResponse | null = null;

    // 1. Stable UUID match (most reliable)
    if (featureId && featureId !== 'unknown') {
      measurement = measurements.find((m) => m.id === featureId) ?? null;
    }

    // 2. Name match (legacy / non-UUID entities)
    if (!measurement && featureName) {
      measurement = measurements.find(
        (m) => m.name.toLowerCase() === featureName,
      ) ?? null;
    }

    // ── Parse GeoJSON ring ────────────────────────────────────────────
    let ring: [number, number][] | null = null;
    if (measurement?.geojson) {
      try {
        const geom = measurement.geojson as {
          type?: string;
          coordinates?: [number, number][][];
        };
        if (
          geom.type === 'Polygon' &&
          Array.isArray(geom.coordinates?.[0]) &&
          geom.coordinates[0].length >= 3
        ) {
          ring = geom.coordinates[0];
        }
      } catch {
        // silently ignore malformed geometry
      }
    }

    // ── Match stockpile analytics ─────────────────────────────────────
    // StockpileRecord.pile_id is the FK to measurements.id
    const stockpile: StockpileRecord | null = measurement
      ? (stockpiles.find((s) => s.pile_id === measurement!.id) ?? null)
      : null;

    return {
      measurement,
      stockpile,
      ring,
      isLoading: false,
    };
  }, [feature, measurements, stockpiles]);

  return {
    ...result,
    isLoading: measurementsLoading || stockpilesLoading,
  };
}
