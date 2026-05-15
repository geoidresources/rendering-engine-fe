/**
 * Backend-driven export of a single measurement to a vector file
 * (Shapefile zip / KML / KMZ / DXF) or a clipped GeoTIFF.
 *
 * Vector formats stream the bytes directly through the asset-svc handler,
 * mirroring the ExportPdfButton blob-download pattern. GeoTIFF runs the
 * gdalwarp clip on the server, persists the result to GCS, and returns a
 * 1-hour signed download URL — the browser is then redirected to that URL
 * (the GCS object's Content-Disposition forces a download rather than a
 * preview).
 */

import { assetSvcClient } from '@/lib/http';

export type VectorExportFormat = 'shp' | 'kml' | 'kmz' | 'dxf';
export type RasterExportSource = 'ortho' | 'dsm' | 'dtm';

/** Returned by the server for format=shp. Each field is a public GCS URL (no expiry). */
export interface ShapefileExportResponse {
  shp: string;
  shx: string;
  dbf: string;
  prj: string;
  cpg: string;
  /** Base filename without extension, e.g. "auto_pile_80_20260417". */
  basename: string;
}

interface RasterExportResponse {
  export_id: string;
  source: RasterExportSource;
  url: string;
  expires_at: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
}

const SHP_EXTENSIONS = ['shp', 'shx', 'dbf', 'prj', 'cpg'] as const;

/**
 * Trigger a cross-origin download by appending a hidden iframe pointing at
 * the URL. The browser honours the GCS object's `Content-Disposition: attachment`
 * header and saves the file without navigating the parent page. This works
 * across origins without needing CORS — `fetch().blob()` requires
 * `Access-Control-Allow-Origin` on the GCS bucket, which we don't configure.
 */
function downloadViaIframe(url: string): void {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  // Keep the iframe around long enough for the download to start, then
  // remove it to avoid leaking DOM nodes.
  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }, 60_000);
}

/** Returned by the server for format=kml|kmz|dxf. */
interface VectorFileExportResponse {
  format: string;
  url: string;     // public GCS URL, no expiry
  filename: string;
}

/**
 * Export a measurement geometry as a downloadable vector file.
 *
 * All formats upload to GCS and return signed download URLs — no binary is
 * streamed through the API response.
 *
 * - SHP: JSON with 5 signed URLs (one per shapefile component). Each is
 *   downloaded via a hidden iframe (cross-origin safe — no CORS required;
 *   the GCS object's Content-Disposition: attachment makes the browser save).
 * - KML / KMZ / DXF: JSON with a single signed URL. The URL's
 *   Content-Disposition is "attachment", so navigating to it triggers a
 *   file download rather than an in-browser render.
 */
export async function exportMeasurementVector(
  measurementId: string,
  format: VectorExportFormat,
  filename: string,
): Promise<void> {
  if (format === 'shp') {
    const res = await assetSvcClient.post<ShapefileExportResponse>(
      `/asset-svc/api/v1/measurements/${measurementId}/export`,
      { format: 'shp' },
    );
    const urls = res.data;
    for (let i = 0; i < SHP_EXTENSIONS.length; i++) {
      const ext = SHP_EXTENSIONS[i];
      const signedURL = urls[ext];
      if (!signedURL) continue;
      // Stagger to avoid the browser collapsing simultaneous downloads.
      if (i > 0) await new Promise((r) => setTimeout(r, 250));
      downloadViaIframe(signedURL);
    }
    return;
  }

  // KML / KMZ / DXF — single signed URL; navigate to it to trigger the download.
  // Content-Disposition: attachment on the GCS object keeps the user on the
  // current page (the browser won't navigate away for attachment responses).
  const res = await assetSvcClient.post<VectorFileExportResponse>(
    `/asset-svc/api/v1/measurements/${measurementId}/export`,
    { format },
  );
  if (typeof window !== 'undefined' && res.data.url) {
    window.location.assign(res.data.url);
  }
  void filename;
}

/**
 * Export a measurement as a clipped GeoTIFF. Synchronous on the server —
 * resolves once gdalwarp finishes and the result is uploaded to GCS. The
 * returned signed URL is 1 hour-valid; redirecting triggers the download.
 */
export async function exportMeasurementGeoTiff(
  measurementId: string,
  source: RasterExportSource,
): Promise<RasterExportResponse> {
  const res = await assetSvcClient.post<RasterExportResponse>(
    `/asset-svc/api/v1/measurements/${measurementId}/export/geotiff`,
    { source },
  );
  return res.data;
}

/**
 * Helper: kick off a GeoTIFF export and immediately redirect the browser
 * to the signed URL so it downloads. The component handles the toast/loading
 * state.
 */
export async function downloadMeasurementGeoTiff(
  measurementId: string,
  source: RasterExportSource,
): Promise<void> {
  const result = await exportMeasurementGeoTiff(measurementId, source);
  if (typeof window !== 'undefined' && result.url) {
    window.location.assign(result.url);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Inline export — for in-progress polygons that haven't been saved yet.
// Used by the Inspector tab "Download" dropdown beside the "Save as stockpile"
// button. Hits a separate backend route that accepts the polygon GeoJSON
// inline (no measurement_id required). Result is NOT persisted on the server.
// ────────────────────────────────────────────────────────────────────────────

interface InlineVectorBody {
  format: VectorExportFormat;
  name: string;
  geojson: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

interface InlineRasterBody {
  source: RasterExportSource;
  name: string;
  survey_id: string;
  geojson: Record<string, unknown>;
}

/**
 * Export an in-progress polygon (no measurement_id). Mirrors
 * exportMeasurementVector: SHP returns 5 component URLs, the others return a
 * single URL the browser can navigate to (Content-Disposition: attachment on
 * the GCS object triggers a download without page navigation).
 */
export async function exportInlineVector(
  format: VectorExportFormat,
  geojson: Record<string, unknown>,
  name: string,
  filename: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const body: InlineVectorBody = { format, name, geojson, properties };

  if (format === 'shp') {
    const res = await assetSvcClient.post<ShapefileExportResponse>(
      '/asset-svc/api/v1/inline-exports/vector',
      body,
    );
    const urls = res.data;
    for (let i = 0; i < SHP_EXTENSIONS.length; i++) {
      const ext = SHP_EXTENSIONS[i];
      const signedURL = urls[ext];
      if (!signedURL) continue;
      if (i > 0) await new Promise((r) => setTimeout(r, 250));
      downloadViaIframe(signedURL);
    }
    return;
  }

  const res = await assetSvcClient.post<VectorFileExportResponse>(
    '/asset-svc/api/v1/inline-exports/vector',
    body,
  );
  if (typeof window !== 'undefined' && res.data.url) {
    window.location.assign(res.data.url);
  }
  // filename is unused for the URL-redirect path — the GCS object's
  // Content-Disposition carries the correct filename; passing it here keeps
  // the function signature symmetric with exportMeasurementVector.
  void filename;
}

/**
 * Run gdalwarp on an in-progress polygon against the active survey raster.
 * surveyId comes from viewerStore.activeSurveyId.
 */
export async function exportInlineGeoTiff(
  source: RasterExportSource,
  geojson: Record<string, unknown>,
  surveyId: string,
  name: string,
): Promise<void> {
  const body: InlineRasterBody = { source, name, survey_id: surveyId, geojson };
  const res = await assetSvcClient.post<RasterExportResponse>(
    '/asset-svc/api/v1/inline-exports/geotiff',
    body,
  );
  if (typeof window !== 'undefined' && res.data.url) {
    window.location.assign(res.data.url);
  }
}
