"use client";

/**
 * CityTwinLayersPanel — floating layer toggles for /live-city/[cityId].
 *
 * Sits at the top-LEFT of the viewer (the top-right slot is already
 * occupied by the Convert button + ConversionProgressPanel). Reads + writes
 * the cityTwinViewerStore — each row shows:
 *   - checkbox (visible)
 *   - layer name
 *   - opacity range slider 0..100 (disabled for terrain, which has no alpha)
 *   - status pill (idle / loading / ready / error) with hover-tooltip
 *
 * Visual language matches the Convert button and ConversionProgressPanel:
 * rounded card, dark translucent backdrop, hairline white border,
 * font-mono labels in small caps.
 */

import { useCityTwinViewerStore, type CityTwinLayerId } from "@/store/cityTwinViewerStore";

interface LayerRowSpec {
  id: CityTwinLayerId;
  label: string;
  /** Cesium has no alpha on the terrain provider — disable the opacity slider. */
  supportsOpacity: boolean;
}

const ROWS: LayerRowSpec[] = [
  { id: "mesh", label: "Mesh", supportsOpacity: false },
  { id: "terrain", label: "Terrain", supportsOpacity: false },
  { id: "ortho", label: "Orthophoto", supportsOpacity: true },
  { id: "points", label: "Point Cloud", supportsOpacity: false },
  { id: "vector", label: "Vectors", supportsOpacity: false },
];

export function CityTwinLayersPanel() {
  const layers = useCityTwinViewerStore((s) => s.layers);
  const setVisible = useCityTwinViewerStore((s) => s.setVisible);
  const setOpacity = useCityTwinViewerStore((s) => s.setOpacity);

  return (
    // Wrapper is pointer-events-none so the globe handles clicks outside
    // the card; the card itself opts back in via pointer-events-auto so
    // checkboxes / sliders work.
    <div className="pointer-events-none absolute left-4 top-4 z-30">
      <div className="pointer-events-auto w-64 rounded-lg border border-white/10 bg-black/80 text-white shadow-xl backdrop-blur">
        <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wide">Layers</h3>
        </header>

        <div className="divide-y divide-white/5">
          {ROWS.map((row) => {
            const slot = layers[row.id];
            return (
              <LayerRow
                key={row.id}
                spec={row}
                visible={slot.visible}
                opacity={slot.opacity}
                status={slot.status}
                error={slot.error}
                onToggle={(v) => setVisible(row.id, v)}
                onOpacity={(v) => setOpacity(row.id, v)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function LayerRow({
  spec,
  visible,
  opacity,
  status,
  error,
  onToggle,
  onOpacity,
}: {
  spec: LayerRowSpec;
  visible: boolean;
  opacity: number;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  onToggle: (v: boolean) => void;
  onOpacity: (v: number) => void;
}) {
  const opacityLocked = !visible || !spec.supportsOpacity;
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Toggle ${spec.label}`}
          className="h-3.5 w-3.5 cursor-pointer accent-sky-400"
        />
        <span className="flex-1 font-mono text-[11px] uppercase tracking-wide text-white/90">
          {spec.label}
        </span>
        <StatusPill status={status} error={error} />
      </div>

      <div
        className={
          opacityLocked
            ? "mt-1.5 flex items-center gap-2 opacity-40"
            : "mt-1.5 flex items-center gap-2"
        }
        title={
          !spec.supportsOpacity
            ? "Opacity unavailable for this layer."
            : !visible
            ? "Turn this layer on to change opacity."
            : "Drag to change layer opacity."
        }
      >
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(opacity * 100)}
          disabled={opacityLocked}
          onChange={(e) => onOpacity(parseInt(e.target.value, 10) / 100)}
          aria-label={`Opacity for ${spec.label}`}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-sm bg-white/10 accent-sky-400 disabled:cursor-not-allowed"
        />
        <span
          className="w-8 text-right font-mono text-[10px] text-white/60"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(opacity * 100)}%
        </span>
      </div>
    </div>
  );
}

function StatusPill({
  status,
  error,
}: {
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
}) {
  // Tuple of (dot colour class, label, additional dot class for animation)
  const visual = {
    idle: { dot: "bg-white/30", label: "idle", anim: "" },
    loading: { dot: "bg-amber-400", label: "loading", anim: "animate-pulse" },
    ready: { dot: "bg-emerald-400", label: "ready", anim: "" },
    error: { dot: "bg-red-500", label: "error", anim: "" },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white/70"
      title={status === "error" && error ? error : visual.label}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${visual.dot} ${visual.anim}`} />
      {visual.label}
    </span>
  );
}
