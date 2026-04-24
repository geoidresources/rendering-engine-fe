/**
 * V-OUTPUT-02 — export a measurement row as GeoJSON.
 *
 * Backend shape differs between the inventory endpoint (where `geojson`
 * is a stringified geometry) and the CRUD endpoint (where it's already
 * parsed). The helper accepts either and wraps it in a Feature so the
 * file round-trips through geojson.io without manual massaging.
 */
import { downloadBlob } from './csvExport';

interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface ExportableMeasurement {
  id: string;
  name: string;
  feature_type: string;
  geojson?: string | Record<string, unknown> | null;
  properties?: Record<string, unknown> | null;
  is_locked?: boolean;
  created_at?: string;
  updated_at?: string;
  volume_m3?: number | null;
  tonnage?: number | null;
  area_m2?: number | null;
  material_type?: string | null;
}

export function exportMeasurementAsGeoJson(
  measurement: ExportableMeasurement,
  filename: string,
): void {
  const geometry = parseGeometry(measurement.geojson);

  const feature = {
    type: 'Feature',
    geometry,
    properties: {
      id: measurement.id,
      name: measurement.name,
      feature_type: measurement.feature_type,
      material_type: measurement.material_type ?? null,
      volume_m3: measurement.volume_m3 ?? null,
      tonnage: measurement.tonnage ?? null,
      area_m2: measurement.area_m2 ?? null,
      is_locked: measurement.is_locked ?? false,
      created_at: measurement.created_at ?? null,
      updated_at: measurement.updated_at ?? null,
      ...(measurement.properties ?? {}),
    },
  };

  const pretty = JSON.stringify(feature, null, 2);
  downloadBlob(
    new Blob([pretty], { type: 'application/geo+json;charset=utf-8;' }),
    filename,
  );
}

function parseGeometry(
  input: string | Record<string, unknown> | null | undefined,
): GeoJsonGeometry | null {
  if (input == null) return null;
  let candidate: unknown = input;
  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input);
    } catch (err) {
      console.warn('[geojsonExport] geometry parse failed — exporting empty Feature', err);
      return null;
    }
  }
  if (!candidate || typeof candidate !== 'object') return null;
  if (!('type' in candidate) || !('coordinates' in candidate)) return null;
  return candidate as GeoJsonGeometry;
}
