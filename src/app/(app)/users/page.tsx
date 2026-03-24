import PageShell from "@/components/ui/PageShell";

export default function UsersPage() {
  return (
    <PageShell
      title="Users & Roles"
      description="Invite users, assign roles, revoke access, and view audit logs."
      action={{ label: "Invite User", href: "#" }}
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          User table with role badges (Super Admin, GEOID Admin, Analyst, Project Manager, Client Viewer/Approver, External Read-only), invite flow, and access change audit log will render here.
        </p>
      </div>
    </PageShell>
  );
}
