"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { SiteLocationProp } from "@/components/globe/GlobeScene";
import { apiClient } from "@/lib/http";
import type { Project, Survey } from "@/types/api";
import type { Manifest } from "@/types/manifest";

const Viewer = dynamic(() => import("@/app/mapview/Viewer"), { ssr: false });
const GlobeScene = dynamic(() => import("@/components/globe/GlobeScene"), { ssr: false });

/**
 * Resolve project coordinates:
 *   1. project.settings.coordinates (explicit)
 *   2. first survey manifest bbox centre (derived)
 */
/** Unwrap the `{data: T[], pagination}` envelope that list endpoints use. */
function unwrapList<T>(res: { data: unknown }): T[] {
  const d = res.data as any;
  return Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
}

async function resolveProjectSites(): Promise<SiteLocationProp[]> {
  const projects = unwrapList<Project>(
    await apiClient.get("/api/v1/projects"),
  );
  const sites: SiteLocationProp[] = [];

  for (const proj of projects) {
    const coords = proj.settings?.coordinates as { lat: number; lng: number } | undefined;
    if (coords && isFinite(coords.lat) && isFinite(coords.lng)) {
      sites.push({ lat: coords.lat, lng: coords.lng, name: proj.name });
      continue;
    }

    if (proj.survey_count > 0) {
      try {
        const surveys = unwrapList<Survey>(
          await apiClient.get(`/api/v1/surveys?project_id=${proj.id}`),
        );
        const first = surveys[0];
        if (!first) continue;
        const manRes = await apiClient.get<Manifest>(
          `/api/v1/surveys/${first.id}/manifest`,
        );
        // manifest is returned without envelope
        const manifest = manRes.data as Manifest;
        const bbox = manifest?.assets?.find((a) => a.bbox?.length === 4)
          ?.bbox as [number, number, number, number] | undefined;
        if (bbox) {
          sites.push({
            lat: (bbox[1] + bbox[3]) / 2,
            lng: (bbox[0] + bbox[2]) / 2,
            name: proj.name,
            bbox,
          });
        }
      } catch { /* manifest unavailable */ }
    }
  }
  return sites;
}

export default function MapViewPage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId") ?? undefined;
  const [sites, setSites] = useState<SiteLocationProp[]>([]);

  useEffect(() => {
    if (!surveyId) {
      resolveProjectSites().then(setSites).catch(() => {});
    }
  }, [surveyId]);

  if (surveyId) {
    return <Viewer surveyId={surveyId} />;
  }

  return (
    <div className="w-screen h-screen bg-[#020208]">
      <GlobeScene sites={sites} />
    </div>
  );
}
