"use client";

import PageShell from "@/components/ui/PageShell";

export default function SurveyUploadPage() {
  return (
    <PageShell
      title="Survey Upload & Ingestion"
      description="Guided upload flow — drag and drop GeoTIFFs, LAS/LAZ, SHP/DXF, CSV or mesh files."
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          Step-by-step upload wizard (file drop → validation → metadata confirmation → preview → approve) will render here.
        </p>
      </div>
    </PageShell>
  );
}
