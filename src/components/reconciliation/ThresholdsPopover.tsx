// ThresholdsPopover exposes the green/amber band that classifies
// reconciliation rows as OK / WARN / FLAG. The operator can tune the bands
// for their tenant, or delete the override to fall back to the seeded
// __default__ row. Validation stays in step with the backend:
//   - 0 <= green < amber <= 100
//
// Same click-outside + Escape pattern as RunReconciliationPopover —
// consistent UX without introducing a new primitive.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useDeleteThreshold,
  useThresholds,
  useUpsertThreshold,
} from "@/hooks/useReconciliation";

const METRIC = "reconciliation";

export default function ThresholdsPopover() {
  const [open, setOpen] = useState(false);
  const { data: thresholds } = useThresholds();
  const upsert = useUpsertThreshold();
  const del = useDeleteThreshold();
  const panelRef = useRef<HTMLDivElement>(null);

  const clientRow = useMemo(
    () =>
      (thresholds ?? []).find(
        (t) => t.metric_type === METRIC && t.source === "client",
      ),
    [thresholds],
  );
  const defaultRow = useMemo(
    () =>
      (thresholds ?? []).find(
        (t) => t.metric_type === METRIC && t.source === "default",
      ),
    [thresholds],
  );
  const active = clientRow ?? defaultRow;

  const [green, setGreen] = useState<string>("");
  const [amber, setAmber] = useState<string>("");

  useEffect(() => {
    if (active) {
      setGreen(String(active.green_upper_pct));
      setAmber(String(active.amber_upper_pct));
    }
  }, [active]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const handleSave = async () => {
    const g = Number(green);
    const a = Number(amber);
    if (!Number.isFinite(g) || !Number.isFinite(a)) {
      toast.error("Enter numeric values for green/amber");
      return;
    }
    if (g < 0 || a > 100 || g >= a) {
      toast.error("Require 0 ≤ green < amber ≤ 100");
      return;
    }
    try {
      await upsert.mutateAsync({
        metric: METRIC,
        green_upper_pct: g,
        amber_upper_pct: a,
      });
      toast.success("Threshold saved");
      setOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: string }; message?: string })?.data?.error ??
        (err as { message?: string })?.message ??
        "Failed to save threshold";
      toast.error(msg);
    }
  };

  const handleRevert = async () => {
    if (!clientRow) {
      setOpen(false);
      return;
    }
    try {
      await del.mutateAsync(METRIC);
      toast.success("Reverted to default threshold");
      setOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: string }; message?: string })?.data?.error ??
        (err as { message?: string })?.message ??
        "Failed to revert threshold";
      toast.error(msg);
    }
  };

  return (
    <div className="relative inline-block" ref={panelRef}>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Edit thresholds"
      >
        <Settings className="size-3.5" />
      </Button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-lg border border-border bg-background p-4 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Variance thresholds
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {clientRow
              ? "Using tenant override"
              : "Inheriting seeded default"}
            {defaultRow && (
              <>
                {" "}
                (default {defaultRow.green_upper_pct}% /
                {defaultRow.amber_upper_pct}%)
              </>
            )}
          </p>

          <label className="mt-3 flex flex-col gap-1 text-[11px] text-muted-foreground">
            Green upper (%) — rows ≤ this stay green
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={green}
              onChange={(e) => setGreen(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>

          <label className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
            Amber upper (%) — rows above this flag red
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={amber}
              onChange={(e) => setAmber(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>

          <div className="mt-4 flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevert}
              disabled={del.isPending || !clientRow}
            >
              Revert to default
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={upsert.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={upsert.isPending}
              >
                {upsert.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
