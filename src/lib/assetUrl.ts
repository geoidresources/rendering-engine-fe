const GCS_HOST = 'https://storage.googleapis.com/';

/**
 * Rewrite a public GCS URL so it passes through the rendering-engine-be
 * asset proxy (`/api/v1/assets/proxy/...`). The public bucket doesn't send
 * CORS headers, so Cesium's ImageryProvider / GeoJsonDataSource / Model
 * loaders fail on direct fetches; the proxy re-serves the bytes with the
 * backend's CORS middleware attached.
 *
 * Non-GCS URLs and undefined inputs pass through unchanged.
 */
export function rewriteGcsUrl(url: string | undefined): string | undefined {
  if (!url || !url.startsWith(GCS_HOST)) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  return url.replace(GCS_HOST, `${base}/api/v1/assets/proxy/`);
}
