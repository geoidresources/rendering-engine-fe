"use client";

import PageShell from "@/components/ui/PageShell";

export default function MeasurementsPage() {
  return (
    <PageShell
      title="Measurements"
      description="Volumetrics engine — draw polygons, define reference, and compute stockpile or cut/fill volumes."
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          Measurement table with filters (type, date, region, status) and polygon-based volumetric input will render here.
        </p>
      </div>
    </PageShell>
  );
}
