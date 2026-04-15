"use client";

import { useCallback } from "react";
import { apiClient, unwrapList } from "@/lib/http";
import { useViewerStore } from "@/store/viewerStore";
import type { ListEnvelope, Project, Survey } from "@/types/api";
import type { Manifest } from "@/types/manifest";

/**
 * Returns a callable that flies the globe/Cesium viewer to a project's location.
 *
 * Resolution order (matches the pattern in /project/page.tsx):
 *   1. project.settings.coordinates (explicit {lat,lng})
 *   2. First survey's manifest bbox centre
 *   3. No-op (logs a debug warning)
 *
 * Also exposes `flyToSurvey` to fly to a specific survey's bbox.
 */
export function useFlyToProject() {
  const flyTo = useViewerStore((s) => s.flyTo);

  const flyToProject = useCallback(
    async (project: Project) => {
      const coords = project.settings?.coordinates;
      if (
        coords &&
        Number.isFinite(coords.lat) &&
        Number.isFinite(coords.lng)
      ) {
        flyTo({
          lng: coords.lng,
          lat: coords.lat,
          height: 3000,
          label: project.name,
        });
        return;
      }

      // Fallback: derive from the first survey's manifest bbox.
      if (project.survey_count <= 0) {
        console.debug(
          "[flyToProject] no coords and no surveys for",
          project.name,
        );
        return;
      }
      try {
        const surveysRes = await apiClient.get<ListEnvelope<Survey>>(
          `/api/v1/surveys?project_id=${project.id}`,
        );
        const surveys = unwrapList<Survey>(surveysRes.data);
        const first = surveys[0];
        if (!first) return;

        const manRes = await apiClient.get<Manifest>(
          `/api/v1/surveys/${first.id}/manifest`,
        );
        const manifest = manRes.data;
        const bounds = manifest?.bounds;
        if (bounds) {
          flyTo({
            lat: (bounds.south + bounds.north) / 2,
            lng: (bounds.west + bounds.east) / 2,
            bounds,
            label: project.name,
          });
          return;
        }
        // No bounds: try any asset bbox.
        const bbox = manifest?.assets?.find((a) => a.bbox?.length === 4)
          ?.bbox as [number, number, number, number] | undefined;
        if (bbox) {
          flyTo({
            lng: (bbox[0] + bbox[2]) / 2,
            lat: (bbox[1] + bbox[3]) / 2,
            bounds: { west: bbox[0], south: bbox[1], east: bbox[2], north: bbox[3] },
            label: project.name,
          });
        }
      } catch (err) {
        console.debug("[flyToProject] manifest lookup failed", err);
      }
    },
    [flyTo],
  );

  const flyToSurvey = useCallback(
    async (survey: Survey) => {
      try {
        const manRes = await apiClient.get<Manifest>(
          `/api/v1/surveys/${survey.id}/manifest`,
        );
        const manifest = manRes.data;
        const bounds = manifest?.bounds;
        if (bounds) {
          flyTo({
            lat: (bounds.south + bounds.north) / 2,
            lng: (bounds.west + bounds.east) / 2,
            bounds,
            height: 800,
          });
        }
      } catch (err) {
        console.debug("[flyToSurvey] manifest lookup failed", err);
      }
    },
    [flyTo],
  );

  return { flyToProject, flyToSurvey };
}
