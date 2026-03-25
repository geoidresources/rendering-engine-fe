"use client";

import dynamic from "next/dynamic";

// Dynamically import the Viewer component with SSR disabled
const Viewer = dynamic(() => import("@/components/Viewer"), {
  ssr: false,
});

export default function FormDemoPage() {
    return (
        <Viewer />
    );
}
