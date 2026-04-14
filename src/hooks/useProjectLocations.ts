import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http";
import type { Project, Survey } from "@/types/api";
import type { Manifest } from "@/types/manifest";

export interface SiteLocation {
  lat: number;
  lng: number;
  name: string;
  projectId: string;
  /** [west, south, east, north] from the survey manifest asset bbox. */
  bbox?: [number, number, number, number];
}

/**
 * Resolves geographic coordinates for every project the authenticated user
 * can see.
 *
 * Resolution order:
 *   1. `project.settings.coordinates` (explicit lat/lng)
 *   2. First survey → manifest → first asset with a bbox → centre point
 */
export function useProjectLocations() {
  return useQuery({
    queryKey: ["project-locations"],
    queryFn: async (): Promise<SiteLocation[]> => {
      const projRes = await apiClient.get<Project[]>("/api/v1/projects");
      const projects = projRes.data ?? [];

      const locations: SiteLocation[] = [];

      for (const proj of projects) {
        // --- 1. Explicit coordinates in settings ---
        const coords = proj.settings?.coordinates as
          | { lat: number; lng: number }
          | undefined;
        if (coords && isFinite(coords.lat) && isFinite(coords.lng)) {
          locations.push({
            lat: coords.lat,
            lng: coords.lng,
            name: proj.name,
            projectId: proj.id,
          });
          continue;
        }

        // --- 2. Derive from survey manifest bbox ---
        if (proj.survey_count > 0) {
          try {
            const survRes = await apiClient.get<Survey[]>(
              `/api/v1/surveys?project_id=${proj.id}`,
            );
            const firstSurvey = survRes.data?.[0];
            if (!firstSurvey) continue;

            const manRes = await apiClient.get<Manifest>(
              `/api/v1/surveys/${firstSurvey.id}/manifest`,
            );
            const bbox = manRes.data?.assets?.find((a) => a.bbox?.length === 4)
              ?.bbox as [number, number, number, number] | undefined;

            if (bbox) {
              locations.push({
                lat: (bbox[1] + bbox[3]) / 2,
                lng: (bbox[0] + bbox[2]) / 2,
                name: proj.name,
                projectId: proj.id,
                bbox,
              });
            }
          } catch {
            // Manifest unavailable — skip project
          }
        }
      }

      return locations;
    },
    staleTime: 5 * 60_000,
  });
}
