"use client";

// Next.js 16 disallows `ssr: false` on `next/dynamic` in Server Components.
// CesiumJS touches `window` on import, so it MUST be client-only — which
// means this page has to be a Client Component. We unwrap the async
// `params` Promise via React 19's `use()` so the route still gets its
// `cityId` parameter without going async.

import dynamic from "next/dynamic";
import { use } from "react";

const LiveCityViewer = dynamic(() => import("./LiveCityViewer"), { ssr: false });

export default function LiveCityPage({
  params,
}: {
  params: Promise<{ cityId: string }>;
}) {
  const { cityId } = use(params);
  return <LiveCityViewer cityId={cityId} />;
}
