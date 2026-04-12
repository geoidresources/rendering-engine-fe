/**
 * Mock data for dashboard sections not yet backed by API endpoints.
 *
 * MOCK_PIPELINE_ACTIVITY  → future: GET /api/v1/dashboard/pipeline-activity?range=month
 * MOCK_PIPELINE_ROWS      → future: GET /api/v1/dashboard/pipeline-status
 * MOCK_PIPELINE_HEALTH    → future: derived from pipeline-status aggregate
 */

export const MOCK_PIPELINE_ACTIVITY = [
  { label: "Jan", value: 12 },
  { label: "Feb", value: 18 },
  { label: "Mar", value: 8 },
  { label: "Apr", value: 24 },
  { label: "May", value: 15 },
  { label: "Jun", value: 30 },
  { label: "Jul", value: 22 },
  { label: "Aug", value: 28 },
  { label: "Sep", value: 35 },
  { label: "Oct", value: 19 },
  { label: "Nov", value: 27 },
  { label: "Dec", value: 14 },
];

export const MOCK_PIPELINE_ROWS: Record<string, unknown>[] = [
  { project: "Pilbara North", epoch: "2026-04-10", stage: "Ortho Tile", duration: "4m 22s", status: "complete" },
  { project: "Kalgoorlie East", epoch: "2026-04-11", stage: "Terrain Gen", duration: "12m 03s", status: "processing" },
  { project: "Pilbara North", epoch: "2026-04-11", stage: "Ingestion", duration: "2m 14s", status: "complete" },
  { project: "Mt Whaleback", epoch: "2026-04-09", stage: "QA Review", duration: "—", status: "queued" },
  { project: "Newman Hub", epoch: "2026-04-08", stage: "Point Cloud", duration: "18m 41s", status: "complete" },
  { project: "Kalgoorlie East", epoch: "2026-04-07", stage: "Ortho Tile", duration: "6m 55s", status: "failed" },
];

export const MOCK_PIPELINE_HEALTH = 72;

export const MOCK_DELTAS = {
  activeProjects: { value: "+2", positive: true },
  surveysThisMonth: { value: "+17%", positive: true },
  openAlerts: { value: "+3", positive: false },
};

export const MOCK_PIPELINE_COUNTS = {
  complete: 42,
  processing: 3,
  failed: 2,
};
