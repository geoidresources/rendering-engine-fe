"use client";

import PageShell from "@/components/ui/PageShell";
import Panel from "@/components/ui/Panel";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { useUsers } from "@/hooks/useUsers";

export default function UsersPage() {
  const { data: users, isLoading } = useUsers();

  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email", mono: true },
    {
      key: "role",
      label: "Role",
      render: (val: unknown) => <StatusBadge variant="tag">{((val as string) || "—").toUpperCase()}</StatusBadge>,
    },
    {
      key: "is_active",
      label: "Status",
      render: (val: unknown) => {
        const active = val as boolean;
        return <StatusBadge variant={active ? "active" : "standby"}>{active ? "Active" : "Inactive"}</StatusBadge>;
      },
    },
    {
      key: "last_login_time",
      label: "Last Active",
      mono: true,
      render: (val: unknown) => {
        const t = val as string | null;
        return <span>{t ? new Date(t).toLocaleDateString() : "—"}</span>;
      },
    },
  ];

  return (
    <PageShell
      title="Users & Roles"
      description="Manage team members, assign roles, and view activity."
      action={{ label: "Invite User", href: "#" }}
    >
      <Panel noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-text-muted text-xs">Loading users...</div>
        ) : (
          <DataTable columns={columns} data={(users ?? []) as unknown as Record<string, unknown>[]} />
        )}
      </Panel>
    </PageShell>
  );
}
