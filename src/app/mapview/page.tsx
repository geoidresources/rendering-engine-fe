"use client";

import dynamic from "next/dynamic";

// Dynamically import the Viewer component with SSR disabled
const Viewer = dynamic(() => import("@/app/mapview/Viewer"), {
  ssr: false,
});

export default function FormDemoPage() {
  return (
    <Viewer />
  );
}
