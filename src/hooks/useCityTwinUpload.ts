/**
 * useCityTwinUpload — orchestrates the per-kind upload ladder for the
 * city-twin attach flow.
 *
 * Per kind:
 *   1. Detect source_format + root_file from the staged files (`detectFormat`).
 *   2. POST /assets/init with the file manifest.
 *   3. PUT each file directly to GCS via `uploadToGCS` (concurrency-limited
 *      to 4).
 *   4. PATCH /assets/:id to finalize (status → uploaded).
 *   5. Invalidate ["city-twin-assets", slug] so the page re-renders the
 *      "existing asset" view.
 *
 * Errors are surfaced inline through the store's per-slot `status="failed"`
 * + `error` fields; the drop-zone renders a Retry button on top of them.
 * The removeUploaded path uses sonner only because archive failures happen
 * outside the slot's lifecycle and have nowhere obvious to inline.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  archiveCityTwinAsset,
  initCityTwinAssetUpload,
  markCityTwinAssetUploaded,
} from "@/lib/api/cityTwinApi";
import { uploadToGCS } from "@/lib/api/assetSvcApi";
import { useCityTwinUploadStore } from "@/store/cityTwinUploadStore";
import type {
  AssetFileManifestItem,
  CityTwinAssetKind,
  InitAssetUploadResponse,
} from "@/types/city-twin";

// File-with-webkitRelativePath is a long-standing browser quirk: the property
// is set when files come from <input webkitdirectory>, but DOM types don't
// model it. One narrow `as` cast per access stays cleaner than a global
// `declare module` augmentation.
type FileWithPath = File & { webkitRelativePath?: string };
const pathOf = (f: File): string => {
  const wp = (f as FileWithPath).webkitRelativePath;
  return wp && wp.length > 0 ? wp : f.name;
};

const extractMsg = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  const maybe = err as { data?: { error?: string }; message?: string };
  return maybe?.data?.error ?? maybe?.message ?? String(err);
};

// ─── Format detection ────────────────────────────────────────────────────────

interface Detection {
  sourceFormat: string;
  rootFile: string;
}

/** Pick the file with the shallowest path (fewest "/" segments), tie-broken
 *  by alphabetical order so the result is deterministic for the same set. */
function shallowestPath(files: File[]): File {
  return [...files].sort((a, b) => {
    const da = pathOf(a).split("/").length;
    const db = pathOf(b).split("/").length;
    if (da !== db) return da - db;
    return pathOf(a).localeCompare(pathOf(b));
  })[0];
}

function matchExt(name: string, ...exts: string[]): boolean {
  const lower = name.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

function detectFormat(kind: CityTwinAssetKind, files: File[]): Detection {
  if (files.length === 0) throw new Error("no files staged");

  switch (kind) {
    case "mesh": {
      const has3mx = files.some((f) => matchExt(f.name, ".3mx"));
      if (has3mx) {
        const root = shallowestPath(files.filter((f) => matchExt(f.name, ".3mx")));
        return { sourceFormat: "3mx", rootFile: pathOf(root) };
      }
      const hasObj = files.some((f) => matchExt(f.name, ".obj"));
      if (hasObj) {
        const root = shallowestPath(files.filter((f) => matchExt(f.name, ".obj")));
        return { sourceFormat: "obj", rootFile: pathOf(root) };
      }
      const hasGlb = files.some((f) => matchExt(f.name, ".glb", ".gltf"));
      if (hasGlb) {
        const root = shallowestPath(files.filter((f) => matchExt(f.name, ".glb", ".gltf")));
        return { sourceFormat: "glb", rootFile: pathOf(root) };
      }
      throw new Error("no .3mx, .obj, or .glb/.gltf file found in staged set");
    }

    case "dsm": {
      const tif = files.find((f) => matchExt(f.name, ".tif", ".tiff"));
      if (!tif) throw new Error("no .tif/.tiff file found in staged set");
      return { sourceFormat: "geotiff", rootFile: pathOf(tif) };
    }

    case "orthophoto": {
      const tif = files.find((f) => matchExt(f.name, ".tif", ".tiff"));
      if (!tif) throw new Error("no .tif/.tiff file found in staged set");
      return { sourceFormat: "geotiff", rootFile: pathOf(tif) };
    }

    case "point_cloud": {
      const copc = files.find((f) => f.name.toLowerCase().endsWith(".copc.laz"));
      if (copc) return { sourceFormat: "copc", rootFile: pathOf(copc) };
      const laz = files.find((f) => matchExt(f.name, ".laz"));
      if (laz) return { sourceFormat: "laz", rootFile: pathOf(laz) };
      const las = files.find((f) => matchExt(f.name, ".las"));
      if (las) return { sourceFormat: "las", rootFile: pathOf(las) };
      throw new Error("no .las/.laz/.copc.laz file found in staged set");
    }

    case "vector": {
      const geo = files.find((f) => matchExt(f.name, ".geojson", ".json"));
      if (geo) return { sourceFormat: "geojson", rootFile: pathOf(geo) };
      const shp = files.find((f) => matchExt(f.name, ".shp"));
      if (!shp) throw new Error("no .geojson/.json or .shp file found in staged set");
      const hasShx = files.some((f) => matchExt(f.name, ".shx"));
      const hasDbf = files.some((f) => matchExt(f.name, ".dbf"));
      if (!hasShx || !hasDbf) {
        throw new Error("shapefile requires .shp + .shx + .dbf sidecars");
      }
      return { sourceFormat: "shp", rootFile: pathOf(shp) };
    }
  }
}

// ─── Concurrency limiter ────────────────────────────────────────────────────

type Semaphore = <T>(fn: () => Promise<T>) => Promise<T>;
function createSemaphore(max: number): Semaphore {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= max || queue.length === 0) return;
    active++;
    const job = queue.shift()!;
    job();
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(run);
      next();
    });
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCityTwinUpload(slug: string) {
  const store = useCityTwinUploadStore();
  const queryClient = useQueryClient();

  const startUpload = useCallback(
    async (kind: CityTwinAssetKind) => {
      // Read the slot fresh from the store — the caller's `slot` snapshot
      // might be stale if React batched a stageFiles + startUpload click.
      const slot = useCityTwinUploadStore.getState().kinds[kind];
      if (slot.files.length === 0) return;

      // 1. Detect source_format + root_file.
      let detection: Detection;
      try {
        detection = detectFormat(kind, slot.files);
      } catch (err) {
        store.setStatus(kind, "failed", extractMsg(err));
        return;
      }

      // 2. Build the file manifest. The path is webkitRelativePath when
      //    present (folder upload via input[webkitdirectory]), else just
      //    the file name. The BE returns one signed URL per entry keyed
      //    by this exact string.
      const manifest: AssetFileManifestItem[] = slot.files.map((f) => ({
        path: pathOf(f),
        size: f.size,
      }));

      // 3. POST /assets/init.
      store.setStatus(kind, "initializing");
      let init: InitAssetUploadResponse;
      try {
        init = await initCityTwinAssetUpload(slug, {
          kind,
          source_format: detection.sourceFormat,
          root_file: detection.rootFile,
          file_manifest: manifest,
        });
      } catch (err) {
        store.setStatus(kind, "failed", extractMsg(err));
        return;
      }

      store.setUploadingAssetId(kind, init.asset_id);
      store.initFileProgress(
        kind,
        slot.files.map((f) => ({
          name: pathOf(f),
          bytes: 0,
          totalBytes: f.size,
          status: "pending",
        })),
      );
      store.setStatus(kind, "uploading");

      // 4. PUT each file. Match signed URL by path. Concurrency = 4.
      const byPath = new Map(init.signed_urls.map((u) => [u.path, u]));
      const sem = createSemaphore(4);
      try {
        await Promise.all(
          slot.files.map((file, idx) =>
            sem(async () => {
              const path = pathOf(file);
              const url = byPath.get(path);
              if (!url) throw new Error(`no signed URL returned for ${path}`);
              store.setFileProgress(kind, idx, 0, "uploading");
              try {
                await uploadToGCS(
                  url.url,
                  file,
                  (loaded) => store.setFileProgress(kind, idx, loaded),
                  url.headers ?? {},
                );
                store.setFileProgress(kind, idx, file.size, "uploaded");
              } catch (err) {
                store.setFileProgress(kind, idx, 0, "failed", extractMsg(err));
                throw err;
              }
            }),
          ),
        );
      } catch (err) {
        store.setStatus(kind, "failed", extractMsg(err));
        return;
      }

      // 5. PATCH finalize.
      store.setStatus(kind, "finalizing");
      try {
        const totalBytes = slot.files.reduce((acc, f) => acc + f.size, 0);
        await markCityTwinAssetUploaded(slug, init.asset_id, { total_bytes: totalBytes });
      } catch (err) {
        store.setStatus(kind, "failed", extractMsg(err));
        return;
      }

      // 6. Invalidate so the page re-fetches and the slot flips to the
      //    "existing asset" view.
      queryClient.invalidateQueries({ queryKey: ["city-twin-assets", slug] });
      store.setUploaded(kind, detection.rootFile, detection.sourceFormat);
    },
    [slug, store, queryClient],
  );

  const removeUploaded = useCallback(
    async (kind: CityTwinAssetKind, assetId: string) => {
      try {
        await archiveCityTwinAsset(slug, assetId);
        store.clearKind(kind);
        queryClient.invalidateQueries({ queryKey: ["city-twin-assets", slug] });
      } catch (err) {
        // Archive failures are out of the slot's normal lifecycle; surface
        // via toast so the operator knows the row didn't actually go away.
        toast.error(`Failed to remove ${kind}: ${extractMsg(err)}`);
      }
    },
    [slug, store, queryClient],
  );

  return { startUpload, removeUploaded };
}
