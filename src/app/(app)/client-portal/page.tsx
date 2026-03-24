import PageShell from "@/components/ui/PageShell";

export default function ClientPortalPage() {
  return (
    <PageShell
      title="Client Portal"
      description="Read-only client view — projects, surveys, approved measurements, reports, and reconciliation summaries."
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          Client-facing project list, survey history, report downloads, measurement library (approved only), and in-app notifications will render here.
        </p>
      </div>
    </PageShell>
  );
}
