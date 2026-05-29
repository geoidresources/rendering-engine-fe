"use client";

// Thin route shim. The inner component renders the actual upload UI;
// keeping it dynamic-loaded mirrors the LiveCityViewer page so the heavy
// citytwin component graph isn't pulled into the initial route bundle.

import dynamic from "next/dynamic";
import { use } from "react";

const UploadPageInner = dynamic(() => import("./UploadPageInner"), { ssr: false });

export default function Page({
  params,
}: {
  params: Promise<{ cityId: string }>;
}) {
  const { cityId } = use(params);
  return <UploadPageInner cityId={cityId} />;
}
