"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import TabBar from "@/components/ui/TabBar";
import Panel from "@/components/ui/Panel";
import StatusBadge from "@/components/ui/StatusBadge";
import { useSurvey, useSurveyAssets } from "@/hooks/useSurveys";
import { useQAAuditLog, useQAChecklist } from "@/hooks/useQA";

const TABS = ["Metadata", "Files", "QA Log", "Approval History"];

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState(0);

  const { data: survey, isLoading } = useSurvey(id);
  const { data: assets } = useSurveyAssets(id);
  const { data: qaLog } = useQAAuditLog(id);
  const { data: qaChecklist } = useQAChecklist(id);

  if (isLoading) {
    return (
      <PageShell title="Survey Detail" description="Loading...">
        <div className="flex items-center justify-center py-20 text-text-muted text-xs">Loading survey...</div>
      </PageShell>
    );
  }

  const statusVariant = survey?.status === "approved" ? "active" : survey?.status === "pending" ? "alert" : "standby";

  return (
    <PageShell
      title={`Survey — ${survey ? new Date(survey.survey_date).toLocaleDateString() : id}`}
      description={`Status: ${survey?.status?.replace(/_/g, " ") ?? "unknown"}`}
    >
      <TabBar tabs={TABS} activeIndex={activeTab} onChange={setActiveTab} />

      {/* Metadata Tab */}
      {activeTab === 0 && survey && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <Panel title="Status">
              <StatusBadge variant={statusVariant}>{survey.status.replace(/_/g, " ").toUpperCase()}</StatusBadge>
            </Panel>
            <Panel title="Survey Date">
              <p className="text-text-primary text-sm font-mono">{new Date(survey.survey_date).toLocaleDateString()}</p>
            </Panel>
            <Panel title="Contract SLA">
              <StatusBadge variant={survey.contract_sla_flag ? "active" : "standby"}>
                {survey.contract_sla_flag ? "Within SLA" : "SLA Breach"}
              </StatusBadge>
            </Panel>
          </div>
          {survey.metadata && Object.keys(survey.metadata).length > 0 && (
            <Panel title="Metadata">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(survey.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-text-muted text-[10px] uppercase tracking-wider">{k.replace(/_/g, " ")}</span>
                    <span className="text-text-secondary text-xs font-mono">{String(v)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* Files Tab */}
      {activeTab === 1 && (
        <div className="mt-4 flex flex-col gap-3">
          {(assets ?? []).length === 0 ? (
            <Panel><p className="text-text-muted text-sm text-center py-4">No assets found.</p></Panel>
          ) : (
            (assets ?? []).map((a) => (
              <Panel key={a.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary text-xs font-mono font-semibold">{a.processor_type.replace(/-/g, " ").toUpperCase()}</p>
                    <p className="text-text-muted text-[10px] font-mono mt-1">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <StatusBadge variant={a.status === "completed" ? "active" : "standby"}>
                    {a.status.toUpperCase()}
                  </StatusBadge>
                </div>
              </Panel>
            ))
          )}
        </div>
      )}

      {/* QA Log Tab */}
      {activeTab === 2 && (
        <div className="mt-4 flex flex-col gap-3">
          {(qaLog ?? []).length === 0 ? (
            <Panel><p className="text-text-muted text-sm text-center py-4">No QA log entries yet.</p></Panel>
          ) : (
            (qaLog ?? []).map((entry) => (
              <Panel key={entry.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-accent text-[10px] font-mono font-medium">{entry.actor_name}</span>
                  <span className="text-text-muted text-[10px] font-mono">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant="tag">{entry.action.replace(/_/g, " ")}</StatusBadge>
                  {entry.previous_status && entry.new_status && (
                    <span className="text-text-secondary text-xs font-mono">
                      {entry.previous_status} → {entry.new_status}
                    </span>
                  )}
                </div>
                {entry.comment && (
                  <p className="text-text-secondary text-xs font-mono mt-2 leading-relaxed">{entry.comment}</p>
                )}
              </Panel>
            ))
          )}
        </div>
      )}

      {/* Approval History Tab */}
      {activeTab === 3 && (
        <div className="mt-4 flex flex-col gap-3">
          {(qaLog ?? [])
            .filter((e) => e.action === "status_change")
            .map((entry) => (
              <Panel key={entry.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary text-xs font-semibold">{entry.actor_name}</p>
                    <p className="text-text-muted text-[10px] font-mono mt-1">
                      {entry.previous_status} → {entry.new_status}
                    </p>
                  </div>
                  <span className="text-text-muted text-[10px] font-mono">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
              </Panel>
            ))}
          {(qaLog ?? []).filter((e) => e.action === "status_change").length === 0 && (
            <Panel><p className="text-text-muted text-sm text-center py-4">No status changes recorded.</p></Panel>
          )}
        </div>
      )}
    </PageShell>
  );
}
