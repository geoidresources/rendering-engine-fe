/**
 * CSV measurement export utility.
 * Converts measurement data to a CSV string and triggers browser download.
 */

export interface MeasurementRow {
  id: string;
  type: string;
  name: string;
  project_id: string;
  survey_id: string;
  coordinates: string;
  distance_m: number | null;
  area_m2: number | null;
  volume_m3: number | null;
  created_at: string;
}

/** Convert an array of measurement rows to CSV format. */
export function toCSV(rows: MeasurementRow[]): string {
  const headers = [
    'id',
    'type',
    'name',
    'project_id',
    'survey_id',
    'coordinates',
    'distance_m',
    'area_m2',
    'volume_m3',
    'created_at',
  ];

  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h as keyof MeasurementRow];
      if (val === null || val === undefined) return '';
      // Escape commas and quotes in string values
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

/** Trigger a browser file download from a Blob. Reused by every viewer
 *  export path (CSV, GeoJSON, PNG, future PDF). Keeps a single place for
 *  the Object-URL revoke so we don't leak blobs across exports. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Trigger a browser file download from a string. */
export function downloadCSV(filename: string, csvContent: string): void {
  downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), filename);
}

/**
 * Export measurements as a CSV file.
 * Fetches from the API and triggers download.
 */
export async function exportMeasurementsCSV(
  measurements: MeasurementRow[],
  projectName = 'geoid',
): Promise<void> {
  const csv = toCSV(measurements);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(`${projectName}_measurements_${date}.csv`, csv);
}

/**
 * V-OUTPUT-02 — single-measurement CSV row. Shares the `MeasurementRow`
 * shape with the bulk exporter so downstream consumers get a consistent
 * schema.
 */
export function exportMeasurementAsCsv(row: MeasurementRow, filename: string): void {
  downloadCSV(filename, toCSV([row]));
}
