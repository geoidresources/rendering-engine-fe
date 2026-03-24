import PageShell from "@/components/ui/PageShell";

export default function QAPage() {
  return (
    <PageShell
      title="QA & Approval"
      description="Internal QA checklist, inline comments, and multi-stage approval workflow."
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          QA checklist, comment threads, approval state machine (Uploaded → QA → Revisions → Approved → Shared → Accepted → Archived), and audit log will render here.
        </p>
      </div>
    </PageShell>
  );
}
