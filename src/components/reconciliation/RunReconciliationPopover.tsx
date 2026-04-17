// RunReconciliationPopover is the "Run reconciliation" button in the
// /reconciliation page header. It collects the period + optional material,
// posts to asset-svc, and relies on the mutation's onSuccess to invalidate
// the summary/list queries — so the popover itself is just form state.
//
// Why a plain-state disclosure instead of a primitive: shadcn's Popover is
// not wired up in this app yet; base-ui's popover works but its keyboard
// affordances would be overkill for a two-field form. A click-outside +
// Escape pattern is transparent, dependency-free, and matches the existing
// form-panel feel on /upload.

"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRunReconciliation } from "@/hooks/useReconciliation";
import type { ProjectMaterial } from "@/types/api";

interface Props {
  projectId: string;
  materials: ProjectMaterial[];
  disabled?: boolean;
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function RunReconciliationPopover({
  projectId,
  materials,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [material, setMaterial] = useState<string>("");
  // Sensible defaults: trailing 30 days ending today. Operators almost
  // always run reconciliation for the most-recent window.
  const [periodStart, setPeriodStart] = useState<string>(() =>
    toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  );
  const [periodEnd, setPeriodEnd] = useState<string>(() =>
    toDateInput(new Date()),
  );
  const run = useRunReconciliation();
  const panelRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = async () => {
    if (!periodStart || !periodEnd) {
      toast.error("Period start and end are required");
      return;
    }
    if (periodStart >= periodEnd) {
      toast.error("Period end must be after period start");
      return;
    }
    try {
      const res = await run.mutateAsync({
        projectId,
        // <input type="date"> gives YYYY-MM-DD; asset-svc's handler wants
        // RFC3339, so pin to midnight UTC.
        period_start: new Date(`${periodStart}T00:00:00Z`).toISOString(),
        period_end: new Date(`${periodEnd}T23:59:59Z`).toISOString(),
        material: material || undefined,
      });
      const count = res.workflow_ids?.length ?? 0;
      toast.success(
        count === 1
          ? "Reconciliation queued"
          : `Reconciliation queued for ${count} materials`,
      );
      if (res.opening_stock_fell_back) {
        toast.info(
          "Opening stock fell back to zero — no prior survey before this window",
        );
      }
      setOpen(false);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string; data?: { error?: string } })?.data?.error ??
        (err as { message?: string })?.message ??
        "Failed to queue reconciliation";
      toast.error(msg);
    }
  };

  return (
    <div className="relative inline-block" ref={panelRef}>
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || !projectId}
      >
        <Play className="size-3.5" />
        Run reconciliation
      </Button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-lg border border-border bg-background p-4 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Run reconciliation
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Opens derive from <code>analytics_stockpiles</code> — no manual
            ledger needed.
          </p>

          <label className="mt-3 flex flex-col gap-1 text-[11px] text-muted-foreground">
            Period start
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>

          <label className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
            Period end
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            />
          </label>

          <label className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
            Material (optional — blank = all)
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="">All materials</option>
              {materials.map((m) => (
                <option key={m.material} value={m.material}>
                  {m.material}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={run.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSubmit}
              disabled={run.isPending}
            >
              {run.isPending ? "Queuing…" : "Run"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
