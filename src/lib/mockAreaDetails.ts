import type { SelectedAreaDetails } from '../store/viewerStore';

function stringSeed(value: string): number {
  let seed = 0;
  for (let i = 0; i < value.length; i++) {
    seed = (seed * 31 + value.charCodeAt(i)) % 100000;
  }
  return seed;
}

export async function fetchMockAreaDetails(
  feature: Record<string, unknown>
): Promise<SelectedAreaDetails> {
  const rawId = String(feature.id ?? feature.region_id ?? feature.name ?? 'roi-001');
  const rawName = String(feature.name ?? feature.label ?? feature.region ?? 'Selected Area');
  const seed = stringSeed(rawId);
  const areaSquareMeters = 18000 + (seed % 7000) * 3;
  const perimeterMeters = 580 + (seed % 240);
  const averageElevationMeters = 92 + (seed % 180) / 10;
  const surveyedDay = 10 + (seed % 18);

  await new Promise((resolve) => window.setTimeout(resolve, 320));

  return {
    id: rawId,
    name: rawName,
    material: ['Coal', 'Overburden', 'Iron Ore', 'Waste Rock'][seed % 4],
    status: ['Active', 'Under Review', 'Ready for Survey'][seed % 3],
    source: ['Drone Survey', 'Survey Team', 'Operations Update'][seed % 3],
    areaSquareMeters,
    perimeterMeters,
    averageElevationMeters,
    lastSurveyedAt: `2026-03-${String(surveyedDay).padStart(2, '0')}`,
    owner: ['Ops Team A', 'Survey Team B', 'Planning Team'][seed % 3],
    notes:
      'Mock backend response for region details. Replace this with the real area-details endpoint when it is available.',
  };
}
