"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { SiteLocationProp } from "@/components/globe/GlobeScene";
import { apiClient, unwrapList } from "@/lib/http";
import type { ListEnvelope, Project, Survey } from "@/types/api";
import type { Manifest } from "@/types/manifest";
import { ProjectsSidebar } from "@/app/(app)/project/sidebar/ProjectsSidebar";

const Viewer = dynamic(() => import("@/app/(app)/project/Viewer"), { ssr: false });
const GlobeScene = dynamic(() => import("@/components/globe/GlobeScene"), { ssr: false });

/**
 * Resolve project coordinates:
 *   1. project.settings.coordinates (explicit)
 *   2. first survey manifest bbox centre (derived)
 *
 * The previous implementation carried its own `unwrapList` defensive helper.
 * It's been replaced with the shared one from `@/lib/http` so every caller
 * shares the same shape-tolerance contract.
 */

async function resolveProjectSites(): Promise<SiteLocationProp[]> {
  const projRes = await apiClient.get<ListEnvelope<Project>>(
    "/api/v1/projects",
  );
  const projects = unwrapList<Project>(projRes.data);
  const sites: SiteLocationProp[] = [];

  for (const proj of projects) {
    const coords = proj.settings?.coordinates as { lat: number; lng: number } | undefined;
    if (coords && isFinite(coords.lat) && isFinite(coords.lng)) {
      sites.push({ lat: coords.lat, lng: coords.lng, name: proj.name });
      continue;
    }

    if (proj.survey_count > 0) {
      try {
        const survRes = await apiClient.get<ListEnvelope<Survey>>(
          `/api/v1/surveys?project_id=${proj.id}`,
        );
        const surveys = unwrapList<Survey>(survRes.data);
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

export default function ProjectPage() {
  return (
    <Suspense fallback={<ProjectPageFallback />}>
      <ProjectPageContent />
    </Suspense>
  );
}

function ProjectPageContent() {
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
    <div className="fixed inset-0 z-40 bg-[#020208]">
      <GlobeScene sites={sites} />
      <ProjectsSidebar />
    </div>
  );
}

function ProjectPageFallback() {
  return <div className="fixed inset-0 z-40 bg-[#020208]" />;
}
