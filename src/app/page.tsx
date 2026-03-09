"use client";

import dynamic from "next/dynamic";

const CesiumViewer = dynamic(() => import("@/components/CesiumViewer"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="w-full h-screen">
      <CesiumViewer />
    </main>
  );
}
