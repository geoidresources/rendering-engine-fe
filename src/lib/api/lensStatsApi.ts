/**
 * Lens-stats API client — POSTs an operator-drawn polygon to the
 * rendering-engine-be synchronous compute endpoint and returns
 * slope/aspect/flow statistics.
 *
 * The endpoint takes 1-3 s for a typical mine-site polygon (the cold
 * path downloads ~50 MB DSM once; subsequent polygons on the same
 * survey hit the local cache and respond in under a second).
 */

import { apiClient } from "@/lib/http";
import type { LensStatsResult } from "@/store/viewerStore";

export async function computeLensStats(
  surveyId: string,
  polygonGeoJSON: GeoJSON.Polygon | GeoJSON.Feature | GeoJSON.FeatureCollection,
  opts: { includeRasters?: boolean } = {},
): Promise<LensStatsResult> {
  // The backend expects a GeoJSON string; serialise on the client so
  // we don't depend on the BE accepting nested objects.
  const polygonStr =
    typeof polygonGeoJSON === "string"
      ? polygonGeoJSON
      : JSON.stringify(polygonGeoJSON);

  const res = await apiClient.post<
    LensStatsResult,
    { polygon_geojson: string; include_rasters?: boolean }
  >(
    `/rendering-engine/surveys/${encodeURIComponent(surveyId)}/compute/lens-stats`,
    {
      polygon_geojson: polygonStr,
      include_rasters: opts.includeRasters ?? false,
    },
  );
  return res.data;
}
