"use client";

import dynamic from "next/dynamic";

// Dynamically import the new Viewer component with SSR disabled
const Viewer = dynamic(() => import("@/components/Viewer"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="w-full h-screen m-0 p-0 overflow-hidden">
      <Viewer />
    </main>
  );
}
