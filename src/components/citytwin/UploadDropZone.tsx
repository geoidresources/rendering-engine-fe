"use client";

/**
 * UploadDropZone — per-kind asset attach card for /live-city/[cityId]/upload.
 *
 * Drives one slot in cityTwinUploadStore via the useCityTwinUpload hook.
 * Visual language mirrors CityTwinLayersPanel + ConversionProgressPanel
 * (dark translucent surface, font-mono small caps headers, hairline white
 * border) so the upload page reads as part of the same tooling.
 *
 * Five logical states drive the render:
 *   1. Has uploaded existing asset       → green row, Replace / Remove buttons.
 *   2. Slot uploading / initializing /
 *      finalizing                        → progress bar + per-file rows.
 *   3. Slot failed                       → red error block + Retry.
 *   4. Idle with staged files            → staged list + Upload / Clear buttons.
 *   5. Idle with nothing staged          → drag-and-drop full zone.
 */

import { useRef, useState } from "react";
import { Upload, X, FolderInput } from "lucide-react";
import { useCityTwinUploadStore } from "@/store/cityTwinUploadStore";
import { useCityTwinUpload } from "@/hooks/useCityTwinUpload";
import type { CityTwinAsset, CityTwinAssetKind } from "@/types/city-twin";

interface Props {
  kind: CityTwinAssetKind;
  slug: string;
  existingAsset?: CityTwinAsset | null;
}

const KIND_LABEL: Record<CityTwinAssetKind, string> = {
  mesh: "Mesh",
  dsm: "Terrain (DSM)",
  orthophoto: "Orthophoto",
  point_cloud: "Point Cloud",
  vector: "Vectors",
};

const KIND_HINT: Record<CityTwinAssetKind, string> = {
  mesh: "3MX folder · OBJ+MTL+textures · GLB · GLTF",
  dsm: "GeoTIFF",
  orthophoto: "GeoTIFF",
  point_cloud: "LAS · LAZ · COPC.LAZ",
  vector: "GeoJSON · Shapefile (.shp+.shx+.dbf)",
};

const KIND_ACCEPT: Record<CityTwinAssetKind, string> = {
  mesh: ".3mx,.3mxb,.obj,.mtl,.glb,.gltf,.png,.jpg,.jpeg,.bin",
  dsm: ".tif,.tiff",
  orthophoto: ".tif,.tiff",
  point_cloud: ".las,.laz",
  vector: ".geojson,.json,.shp,.shx,.dbf,.prj,.cpg",
};

export function UploadDropZone({ kind, slug, existingAsset }: Props) {
  const slot = useCityTwinUploadStore((s) => s.kinds[kind]);
  const stageFiles = useCityTwinUploadStore((s) => s.stageFiles);
  const clearKind = useCityTwinUploadStore((s) => s.clearKind);
  const { startUpload, removeUploaded } = useCityTwinUpload(slug);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const inUpload =
    slot.status === "initializing" ||
    slot.status === "uploading" ||
    slot.status === "finalizing";

  const showExisting =
    !!existingAsset &&
    (existingAsset.status === "uploaded" || existingAsset.status === "verified") &&
    slot.status !== "failed" &&
    !inUpload;

  // ── Handlers ──

  const onPickFiles = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    stageFiles(kind, Array.from(filesList));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // Note: DataTransferItemList.webkitGetAsEntry() would expand dropped
    // folders, but that's a complex traversal. The drop zone targets file
    // sets; for true folder upload, use the dedicated folder picker button
    // which sets webkitRelativePath correctly via the input element.
    onPickFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  // ── Render ──

  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/80 text-white shadow-xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={
              showExisting
                ? "h-2 w-2 rounded-full bg-emerald-400"
                : slot.status === "failed"
                  ? "h-2 w-2 rounded-full bg-red-400"
                  : inUpload
                    ? "h-2 w-2 animate-pulse rounded-full bg-amber-400"
                    : "h-2 w-2 rounded-full bg-white/30"
            }
          />
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wide">
            {KIND_LABEL[kind]}
          </h3>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wide text-white/40">
          {kind}
        </span>
      </header>

      <p className="px-3 pt-2 font-mono text-[10px] uppercase tracking-wide text-white/40">
        {KIND_HINT[kind]}
      </p>

      <div className="p-3">
        {showExisting && existingAsset && (
          <ExistingAssetRow
            asset={existingAsset}
            onReplace={() => clearKind(kind)}
            onRemove={() => removeUploaded(kind, existingAsset.id)}
          />
        )}

        {inUpload && (
          <InProgressView
            // Narrowed by the `inUpload` boolean above; TS can't propagate
            // boolean checks into discriminated unions on store-derived
            // fields, so we re-assert here.
            status={slot.status as "initializing" | "uploading" | "finalizing"}
            perFile={slot.perFile}
          />
        )}

        {slot.status === "failed" && (
          <FailedView
            error={slot.error ?? "upload failed"}
            onRetry={() => startUpload(kind)}
            onClear={() => clearKind(kind)}
          />
        )}

        {!showExisting && !inUpload && slot.status !== "failed" && slot.files.length > 0 && (
          <StagedView
            files={slot.files}
            onUpload={() => startUpload(kind)}
            onClear={() => clearKind(kind)}
          />
        )}

        {!showExisting && !inUpload && slot.status !== "failed" && slot.files.length === 0 && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className={
              "flex flex-col items-center gap-1.5 rounded border border-dashed px-3 py-6 text-center transition-colors cursor-pointer " +
              (dragOver
                ? "border-sky-400/60 bg-sky-400/5"
                : "border-white/20 bg-white/[0.02] hover:border-white/40")
            }
          >
            <Upload className="size-5 text-white/40" />
            <p className="font-mono text-[10px] uppercase tracking-wide text-white/60">
              drop files or click to browse
            </p>
            {kind === "mesh" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dirInputRef.current?.click();
                }}
                className="mt-2 inline-flex items-center gap-1 rounded border border-white/20 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-white/80 hover:bg-white/10"
              >
                <FolderInput className="size-3" />
                select folder
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={KIND_ACCEPT[kind]}
              className="hidden"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {kind === "mesh" && (
              <input
                ref={dirInputRef}
                type="file"
                // webkitdirectory is a DOM attribute that ships with every
                // Chromium browser + Firefox + Safari but is missing from
                // the canonical React JSX typings. The cast keeps strict
                // mode happy without polluting the global JSX namespace.
                {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                className="hidden"
                onChange={(e) => {
                  onPickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ExistingAssetRow({
  asset,
  onReplace,
  onRemove,
}: {
  asset: CityTwinAsset;
  onReplace: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] text-emerald-200">
            {asset.root_file}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-200/60">
            {asset.source_format} · {asset.file_count} file
            {asset.file_count === 1 ? "" : "s"}
            {asset.total_bytes != null ? ` · ${formatBytes(asset.total_bytes)}` : ""}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-white/40">
            uploaded {formatRelative(asset.uploaded_at ?? asset.created_at)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onReplace}
          className="flex-1 rounded border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-white/80 hover:bg-white/10"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="flex-1 rounded border border-red-500/30 bg-red-500/5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-red-300 hover:bg-red-500/15"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function StagedView({
  files,
  onUpload,
  onClear,
}: {
  files: File[];
  onUpload: () => void;
  onClear: () => void;
}) {
  const total = files.reduce((acc, f) => acc + f.size, 0);
  return (
    <div className="space-y-2">
      <div className="max-h-32 overflow-y-auto rounded border border-white/10 bg-white/[0.02]">
        {files.map((f, idx) => {
          const wp = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
          const name = wp && wp.length > 0 ? wp : f.name;
          return (
            <div
              key={`${name}-${idx}`}
              className="flex items-center justify-between gap-2 border-b border-white/5 px-2 py-1 last:border-b-0"
            >
              <span className="truncate font-mono text-[10px] text-white/70">
                {name}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-white/40">
                {formatBytes(f.size)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-white/40">
        {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(total)} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onUpload}
          className="flex-1 rounded border border-sky-500/40 bg-sky-500/15 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-sky-200 hover:bg-sky-500/25"
        >
          Upload
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-white/60 hover:bg-white/10"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}

function InProgressView({
  status,
  perFile,
}: {
  status: "initializing" | "uploading" | "finalizing";
  perFile: { name: string; bytes: number; totalBytes: number; status: string; error?: string }[];
}) {
  const totalBytes = perFile.reduce((acc, p) => acc + p.totalBytes, 0);
  const uploadedBytes = perFile.reduce((acc, p) => acc + p.bytes, 0);
  const pct = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

  const label = {
    initializing: "requesting signed URLs…",
    uploading: `uploading… ${pct}%`,
    finalizing: "finalising…",
  }[status];

  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-amber-300">
        {label}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full bg-amber-400/80 transition-[width] duration-300"
          style={{
            width: `${status === "finalizing" ? 100 : Math.max(2, pct)}%`,
          }}
        />
      </div>
      {perFile.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded border border-white/10 bg-white/[0.02]">
          {perFile.map((p, idx) => (
            <div
              key={`${p.name}-${idx}`}
              className="flex items-center justify-between gap-2 border-b border-white/5 px-2 py-1 last:border-b-0"
            >
              <span className="truncate font-mono text-[10px] text-white/70">
                {p.name}
              </span>
              <StatusPill status={p.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FailedView({
  error,
  onRetry,
  onClear,
}: {
  error: string;
  onRetry: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded border border-red-500/40 bg-red-500/10 p-2 font-mono text-[10px] text-red-300">
        {error}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-amber-200 hover:bg-amber-500/25"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-white/60 hover:bg-white/10"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colour =
    status === "uploaded"
      ? "bg-emerald-400/20 text-emerald-300"
      : status === "uploading"
        ? "bg-amber-400/20 text-amber-300"
        : status === "failed"
          ? "bg-red-500/20 text-red-300"
          : "bg-white/10 text-white/50";
  return (
    <span
      className={`shrink-0 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${colour}`}
    >
      {status}
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
