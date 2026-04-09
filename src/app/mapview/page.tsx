"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// Dynamically import the Viewer component with SSR disabled
const Viewer = dynamic(() => import("@/app/mapview/Viewer"), {
  ssr: false,
});

export default function MapViewPage() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId") ?? undefined;

  return <Viewer surveyId={surveyId} />;
}
