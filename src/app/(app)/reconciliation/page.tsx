"use client";

import PageShell from "@/components/ui/PageShell";

export default function ReconciliationPage() {
  return (
    <PageShell
      title="Reconciliation"
      description="Monthly survey-to-board summary — opening/closing balances, production CSV import, variance highlights."
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          Summary cards, CSV import mapper, variance table, trend chart, analyst commentary, and export controls will render here.
        </p>
      </div>
    </PageShell>
  );
}
