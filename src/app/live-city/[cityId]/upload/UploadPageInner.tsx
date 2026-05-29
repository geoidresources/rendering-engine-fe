"use client";

/**
 * UploadPageInner — attach-assets page for a city digital twin.
 *
 * Layout:
 *   - Top header: twin name + "← Back to viewer" link.
 *   - Body: 5 UploadDropZone cards (one per asset kind), 1 col on mobile,
 *     2 cols md+.
 *   - Sticky bottom bar: "Run conversion" button. Enabled once at least
 *     one of (mesh, dsm, orthophoto) is uploaded or verified — those three
 *     are the minimum set the conversion pipeline can produce visible
 *     output from.
 *
 * Reads:
 *   - useCityTwin(slug) — twin metadata.
 *   - useQuery(["city-twin-assets", slug]) — picks the most-recent
 *     uploaded/verified asset per kind to seed each drop zone's
 *     "existing asset" view.
 *
 * Conversion trigger handoff: on click we POST /convert then push the
 * viewer URL. The viewer's own listConversions() effect picks up the
 * in-flight run and mounts the progress panel automatically — no need
 * to plumb the conversion id through this page.
 */

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Play } from "lucide-react";
import { useCityTwin } from "@/hooks/useCityTwin";
import { listCityTwinAssets, triggerConversion } from "@/lib/api/cityTwinApi";
import { UploadDropZone } from "@/components/citytwin/UploadDropZone";
import type { CityTwinAsset, CityTwinAssetKind } from "@/types/city-twin";

const KIND_ORDER: CityTwinAssetKind[] = [
  "mesh",
  "dsm",
  "orthophoto",
  "point_cloud",
  "vector",
];

/** A conversion needs at least one render surface to be useful. Vector +
 *  point_cloud alone don't render a city — they overlay one. */
const REQUIRED_FOR_CONVERT: CityTwinAssetKind[] = ["mesh", "dsm", "orthophoto"];

export default function UploadPageInner({ cityId }: { cityId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: twin, isLoading: twinLoading } = useCityTwin(cityId);

  const assetsQuery = useQuery<CityTwinAsset[], Error>({
    queryKey: ["city-twin-assets", cityId],
    queryFn: () => listCityTwinAssets(cityId),
    enabled: !!cityId,
    refetchOnWindowFocus: false,
  });

  // Pick the most-recent uploaded/verified asset per kind to seed the
  // "existing asset" view in each drop zone. Newer rows win on the same
  // kind so a fresh upload visually replaces the prior one.
  const existingByKind = useMemo(() => {
    const m = new Map<CityTwinAssetKind, CityTwinAsset>();
    for (const a of assetsQuery.data ?? []) {
      if (a.status !== "uploaded" && a.status !== "verified") continue;
      const prev = m.get(a.kind);
      if (!prev || (a.uploaded_at ?? a.created_at) > (prev.uploaded_at ?? prev.created_at)) {
        m.set(a.kind, a);
      }
    }
    return m;
  }, [assetsQuery.data]);

  const canConvert = REQUIRED_FOR_CONVERT.some((k) => existingByKind.has(k));

  const onConvert = async () => {
    try {
      await triggerConversion(cityId);
      // Invalidate the conversion list so the viewer's own discovery
      // effect picks up the new run on next mount.
      queryClient.invalidateQueries({ queryKey: ["city-twin", cityId] });
      router.push(`/live-city/${cityId}`);
    } catch (err) {
      const msg =
        (err as { data?: { error?: string }; message?: string })?.data?.error ??
        (err as { message?: string })?.message ??
        "Failed to start conversion";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wide text-white/40">
              Upload assets
            </p>
            <h1 className="truncate text-lg font-semibold">
              {twinLoading ? "…" : (twin?.name ?? cityId)}
            </h1>
          </div>
          <Link
            href={`/live-city/${cityId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-white/80 hover:bg-white/10"
          >
            <ArrowLeft className="size-3" />
            Back to viewer
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 pb-24">
        {assetsQuery.isError && (
          <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 font-mono text-[11px] text-red-300">
            failed to load existing assets — {assetsQuery.error.message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {KIND_ORDER.map((kind) => (
            <UploadDropZone
              key={kind}
              kind={kind}
              slug={cityId}
              existingAsset={existingByKind.get(kind) ?? null}
            />
          ))}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-white/50">
            {canConvert
              ? `${[...existingByKind.keys()].length} asset kind${existingByKind.size === 1 ? "" : "s"} ready`
              : "Upload mesh, DSM, or orthophoto to enable conversion"}
          </p>
          <button
            type="button"
            onClick={onConvert}
            disabled={!canConvert}
            className={
              "inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors " +
              (canConvert
                ? "border border-sky-500/40 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30"
                : "cursor-not-allowed border border-white/10 bg-white/5 text-white/30")
            }
          >
            <Play className="size-3" />
            Run conversion
          </button>
        </div>
      </footer>
    </div>
  );
}
