import PageShell from "@/components/ui/PageShell";

const SECTIONS = [
  { label: "Organizations", description: "Onboard and manage client orgs, assign to projects." },
  { label: "Billing", description: "Placeholder — view billing tiers (Survey, Reconcile, Analytics, Enterprise)." },
  { label: "Audit Logs", description: "Filter by user, action, project, date; exportable." },
  { label: "Template Management", description: "Create/edit report templates; assign by client or project type." },
  { label: "System Config", description: "Global settings — coordinate/unit defaults, notification rules, storage quotas." },
];

export default function AdminPage() {
  return (
    <PageShell
      title="Admin Panel"
      description="Super admin and admin only — organisations, billing, audit, templates, and system config."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 transition-colors cursor-default">
            <p className="text-white text-sm font-medium mb-1">{s.label}</p>
            <p className="text-zinc-500 text-xs">{s.description}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
