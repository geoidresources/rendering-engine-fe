/**
 * Remaining mock data — delta indicators on metric cards.
 *
 * These require period-over-period comparison (e.g. "this month vs last month")
 * which is not yet implemented in the backend. All pipeline sections
 * (activity chart, pipeline table, health gauge, counts) now come from
 * GET /api/v1/dashboard/summary.
 *
 * TODO: replace with GET /api/v1/dashboard/summary?include_deltas=true
 * once the backend supports it.
 */

export const MOCK_DELTAS = {
  activeProjects: { value: "+2", positive: true },
  surveysThisMonth: { value: "+17%", positive: true },
  openAlerts: { value: "+3", positive: false },
};
