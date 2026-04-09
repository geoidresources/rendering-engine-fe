"use client";

import Panel from "@/components/ui/Panel";
import MetricStatBlock from "@/components/ui/MetricStatBlock";
import StatusBadge from "@/components/ui/StatusBadge";
import ProgressBar from "@/components/ui/ProgressBar";
import AppButton from "@/components/ui/AppButton";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { useProjects } from "@/hooks/useProjects";
import { getStoredClient } from "@/lib/auth";
import Link from "next/link";

function formatNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function ClientPortalPage() {
  const client = getStoredClient();
  const { data: dashboard } = useDashboardSummary();
  const { data: projects, isLoading } = useProjects();

  const clientName = client?.company_name || client?.name || "Client";

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-accent text-lg font-bold uppercase tracking-wider">Client Portal</h1>
        <Link href="/mapview">
          <AppButton variant="primary" size="sm">Open 3D Viewer</AppButton>
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left — Organization */}
        <div className="col-span-4">
          <Panel title="Organization" noPadding>
            <div className="px-6 py-4 bg-bg-elevated">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-primary text-xs font-semibold">{clientName}</span>
                <StatusBadge variant="active">Active</StatusBadge>
              </div>
              <p className="text-text-muted text-[10px] font-mono">{client?.domain || "—"}</p>
              {client?.country_code && (
                <div className="flex justify-between mt-2">
                  <span className="text-text-muted text-[10px] uppercase tracking-wider">Region</span>
                  <span className="text-text-secondary text-[10px] font-mono">{client.country_code}</span>
                </div>
              )}
            </div>
          </Panel>

          {/* Cloud Processing Status */}
          <Panel title="Cloud Processing" headerAction={<StatusBadge variant="active">Online</StatusBadge>}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-text-muted text-[10px] uppercase tracking-wider">Point Cloud Tiling</span>
                  <span className="text-success text-[10px] font-mono">Complete</span>
                </div>
                <ProgressBar value={100} variant="primary" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-text-muted text-[10px] uppercase tracking-wider">Orthomosaic Render</span>
                  <span className="text-success text-[10px] font-mono">Complete</span>
                </div>
                <ProgressBar value={100} variant="primary" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-text-muted text-[10px] uppercase tracking-wider">Cut/Fill Analysis</span>
                  <span className="text-accent text-[10px] font-mono">Processing</span>
                </div>
                <ProgressBar value={72} variant="warning" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-text-muted text-[10px] uppercase tracking-wider">Contour Generation</span>
                  <span className="text-text-muted text-[10px] font-mono">Queued</span>
                </div>
                <ProgressBar value={0} variant="primary" />
              </div>
            </div>
          </Panel>

          {/* System Health */}
          <Panel>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">API Latency</span>
                <span className="text-success text-xs font-mono">42ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Storage Used</span>
                <span className="text-text-secondary text-xs font-mono">
                  {dashboard ? `${formatNum(dashboard.total_surveys * 2.4)} GB` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">Uptime</span>
                <span className="text-success text-xs font-mono">99.97%</span>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right — Details */}
        <div className="col-span-8 flex flex-col gap-4">
          {/* Welcome banner */}
          <Panel>
            <div>
              <h2 className="text-text-primary text-2xl font-semibold">
                Welcome back, <span className="text-accent">{clientName}</span>
              </h2>
              <p className="text-text-secondary text-sm mt-2 uppercase tracking-wider leading-relaxed">
                {dashboard
                  ? `${dashboard.active_projects} active project${dashboard.active_projects !== 1 ? "s" : ""}, ${dashboard.total_surveys} survey${dashboard.total_surveys !== 1 ? "s" : ""}, ${dashboard.alert_count} alert${dashboard.alert_count !== 1 ? "s" : ""}`
                  : "Loading operational overview..."}
              </p>
            </div>
          </Panel>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <MetricStatBlock title="Projects" value={String(dashboard?.active_projects ?? 0)} />
            <MetricStatBlock title="Total Volume" value={`${formatNum(dashboard?.total_volume_m3 ?? 0)} M³`} />
            <MetricStatBlock title="Total Area" value={`${formatNum(dashboard?.total_area_m2 ?? 0)} M²`} />
          </div>

          {/* Project Sites */}
          <div className="flex items-center justify-between">
            <h3 className="text-text-secondary text-[10px] uppercase tracking-wider font-medium">Project Sites</h3>
            <Link href="/projects" className="text-primary text-[10px] uppercase tracking-wider font-medium hover:text-primary-hover">
              View All Projects
            </Link>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-text-muted text-xs">Loading projects...</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(projects ?? []).map((project) => (
                <Panel key={project.id} noPadding>
                  <div className="h-32 bg-gradient-to-br from-bg-elevated to-bg-base flex items-end p-4">
                    <div>
                      <StatusBadge variant="tag">{project.settings?.crs ?? "WGS84"}</StatusBadge>
                      <h4 className="text-text-primary text-lg font-bold uppercase tracking-wider mt-2">{project.name}</h4>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex gap-6">
                      <div>
                        <p className="text-text-muted text-[10px] uppercase tracking-wider">Surveys</p>
                        <p className="text-text-primary text-sm font-mono font-bold">{project.survey_count}</p>
                      </div>
                      <div>
                        <p className="text-text-muted text-[10px] uppercase tracking-wider">Area</p>
                        <p className="text-text-primary text-sm font-mono font-bold">{formatNum(project.total_area_m2)} M²</p>
                      </div>
                    </div>
                    <Link href={`/projects/${project.id}`}>
                      <AppButton variant="primary" size="sm">View Project</AppButton>
                    </Link>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
