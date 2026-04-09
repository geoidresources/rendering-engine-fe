"use client";

import MetricStatBlock from "@/components/ui/MetricStatBlock";
import AlertFeed from "@/components/ui/AlertFeed";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { getStoredUser } from "@/lib/auth";
import Link from "next/link";

function formatVolume(m3: number): string {
  if (m3 >= 1_000_000) return `${(m3 / 1_000_000).toFixed(1)}M`;
  if (m3 >= 1_000) return `${(m3 / 1_000).toFixed(0)}K`;
  return m3.toFixed(0);
}

export default function HomePage() {
  const { data, isLoading } = useDashboardSummary();
  const user = getStoredUser();
  const userName = user?.name ?? "Operator";

  const stats = data
    ? [
        { title: "Active Projects", value: String(data.active_projects).padStart(2, "0") },
        { title: "Total Surveys", value: String(data.total_surveys).padStart(2, "0") },
        { title: "Open Alerts", value: String(data.alert_count).padStart(2, "0") },
      ]
    : [
        { title: "Active Projects", value: "--" },
        { title: "Total Surveys", value: "--" },
        { title: "Open Alerts", value: "--" },
      ];

  const alerts = (data?.recent_alerts ?? []).map((a) => ({
    id: a.survey_id,
    title: `Survey ${a.status.replace(/_/g, " ")}`,
    description: `${a.project_name} — ${new Date(a.survey_date).toLocaleDateString()}`,
    severity: a.status === "pending" ? ("warning" as const) : ("info" as const),
    timestamp: new Date(a.survey_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header Row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-text-primary text-2xl font-bold uppercase tracking-wider">
            Welcome, {userName}
          </h1>
          <p className="text-text-muted text-xs uppercase tracking-wider mt-1">
            Operational Overview — Mine Site Analytics
          </p>
        </div>
        <div className="flex gap-3">
          {stats.map((stat) => (
            <MetricStatBlock key={stat.title} {...stat} />
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column — Span 8 */}
        <div className="col-span-8 flex flex-col gap-4">
          {/* Volume Summary */}
          <Panel
            title="Volume & Area Summary"
            headerAction={
              <div className="flex gap-2">
                <StatusBadge variant="tag">Live Data</StatusBadge>
              </div>
            }
          >
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-text-muted text-xs">
                Loading analytics...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 py-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-text-muted text-[10px] uppercase tracking-wider">Total Volume</span>
                  <span className="text-primary text-4xl font-mono font-bold">
                    {formatVolume(data?.total_volume_m3 ?? 0)}
                  </span>
                  <span className="text-text-muted text-[10px] font-mono">M³ across all stockpiles</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-text-muted text-[10px] uppercase tracking-wider">Total Area</span>
                  <span className="text-accent text-4xl font-mono font-bold">
                    {formatVolume(data?.total_area_m2 ?? 0)}
                  </span>
                  <span className="text-text-muted text-[10px] font-mono">M² measured area</span>
                </div>
              </div>
            )}
          </Panel>

          {/* Active Alerts */}
          {alerts.length > 0 ? (
            <AlertFeed alerts={alerts} />
          ) : (
            <Panel title="Alerts">
              <p className="text-text-muted text-xs py-4 text-center">No pending alerts</p>
            </Panel>
          )}
        </div>

        {/* Right Column — Span 4 */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Recent Projects */}
          <Panel
            title="Recent Projects"
            headerAction={
              <Link href="/projects" className="text-primary text-[10px] uppercase tracking-wider font-medium hover:text-primary-hover">
                View All
              </Link>
            }
          >
            {isLoading ? (
              <p className="text-text-muted text-xs">Loading...</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(data?.recent_projects ?? []).map((proj) => (
                  <Link key={proj.id} href={`/projects/${proj.id}`} className="flex items-center justify-between hover:bg-bg-elevated/50 -mx-2 px-2 py-1 rounded-sm transition-colors">
                    <div>
                      <p className="text-text-primary text-xs font-mono font-semibold">
                        {proj.name}
                      </p>
                      <p className="text-text-muted text-[10px] font-mono">
                        {new Date(proj.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-text-secondary text-xs font-mono">
                        {proj.survey_count} {proj.survey_count === 1 ? "survey" : "surveys"}
                      </p>
                      <p className="text-success text-[10px] uppercase tracking-wider font-medium">
                        Active
                      </p>
                    </div>
                  </Link>
                ))}
                {(data?.recent_projects ?? []).length === 0 && (
                  <p className="text-text-muted text-xs text-center py-2">No projects yet</p>
                )}
              </div>
            )}
          </Panel>

          {/* Quick Stats */}
          <Panel title="Survey Pipeline">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Pending Surveys</span>
                <span className="text-primary text-xs font-mono">{data?.pending_surveys ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Alert Events</span>
                <span className="text-warning text-xs font-mono">{data?.alert_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">System Status</span>
                <span className="text-success text-xs font-mono uppercase">All Services Online</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
