/**
 * V-TASK-03 — Design overlay parsing.
 *
 * Converts a user-uploaded file (GeoJSON or Shapefile zip/shp) into a
 * plain GeoJSON FeatureCollection for Cesium rendering.
 *
 * Shapefile: uses `shpjs` which handles .zip bundles with the .shp/.dbf
 * sidecar files. Common upload scenario for survey design CAD exports.
 * GeoJSON: parse directly — no dep needed.
 *
 * Returns a GeoJSON FeatureCollection or throws a user-readable message.
 */

export async function parseDesignFile(file: File): Promise<object> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      // Wrap bare geometry or feature arrays into FeatureCollection.
      if (parsed.type === 'FeatureCollection') return parsed;
      if (parsed.type === 'Feature') return { type: 'FeatureCollection', features: [parsed] };
      if (parsed.features) return { type: 'FeatureCollection', features: parsed.features };
      throw new Error('Unrecognised GeoJSON shape');
    } catch (e) {
      throw new Error(`GeoJSON parse failed: ${(e as Error).message}`);
    }
  }

  if (name.endsWith('.zip') || name.endsWith('.shp')) {
    // shpjs is loaded dynamically to avoid pulling it into the main bundle.
    const shpjs = await import('shpjs');
    const buffer = await file.arrayBuffer();
    try {
      const result = await shpjs.default(buffer);
      if (Array.isArray(result)) {
        const features = result.flatMap((fc) => (fc as { features: unknown[] }).features ?? []);
        return { type: 'FeatureCollection', features };
      }
      return result as object;
    } catch (e) {
      throw new Error(`Shapefile parse failed: ${(e as Error).message}`);
    }
  }

  throw new Error('Unsupported file type — upload a .geojson, .json, or .zip (Shapefile).');
}
