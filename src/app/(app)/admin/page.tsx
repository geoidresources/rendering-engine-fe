import PageShell from "@/components/ui/PageShell";
import Panel from "@/components/ui/Panel";

const SECTIONS = [
  { label: "Organizations", description: "Onboard and manage client orgs, assign to projects." },
  { label: "Billing", description: "View billing tiers — Survey, Reconcile, Analytics, Enterprise." },
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
          <Panel key={s.label} className="hover:border-text-muted transition-colors cursor-pointer">
            <p className="text-text-primary text-sm font-medium uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-text-muted text-xs">{s.description}</p>
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
