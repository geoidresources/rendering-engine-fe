"use client";

import { useState } from "react";
import AppButton from "@/components/ui/AppButton";
import StatusBadge from "@/components/ui/StatusBadge";
import Panel from "@/components/ui/Panel";
import { useSurveys } from "@/hooks/useSurveys";
import { useQAAuditLog, useQAChecklist } from "@/hooks/useQA";
import { assetSvcClient } from "@/lib/http";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

type SurveyStatus = "pending" | "under_qa" | "ready_to_approve" | "approved" | "completed";

const STATUS_COLUMNS: { key: SurveyStatus[]; label: string; variant: "alert" | "active" | "standby" }[] = [
  { key: ["pending"], label: "Uploaded", variant: "alert" },
  { key: ["under_qa"], label: "Under QA", variant: "active" },
  { key: ["ready_to_approve", "approved", "completed"], label: "Ready / Approved", variant: "standby" },
];

export default function QAPage() {
  const { data: surveys, isLoading } = useSurveys();
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: qaLog } = useQAAuditLog(selectedSurveyId ?? "");
  const { data: qaChecklist } = useQAChecklist(selectedSurveyId ?? "");

  const selectedSurvey = surveys?.find((s) => s.id === selectedSurveyId);

  const updateSurveyStatus = async (surveyId: string, newStatus: string) => {
    setActionLoading(surveyId);
    try {
      // asset-svc mounts routes under /asset-svc/api/v1/... (see
      // consts.RoutePrefix in the Go service); the status-only PATCH lives at
      // /surveys/:id/status and emits a qa_audit_log row server-side.
      await assetSvcClient.patch(`/asset-svc/api/v1/surveys/${surveyId}/status`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
    } catch (e) {
      console.error("Failed to update survey status:", e);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-accent text-lg font-bold uppercase tracking-wider">QA & Approval Workspace</h1>
        <StatusBadge variant="active">Live</StatusBadge>
      </div>
      <div>
        <h2 className="text-text-primary text-xl font-bold uppercase tracking-wider">Data Verification Pipeline</h2>
        <p className="text-accent text-xs font-mono uppercase tracking-wider mt-1">
          {isLoading ? "Loading surveys..." : `${surveys?.length ?? 0} surveys in pipeline`}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Kanban */}
        <div className="col-span-8 grid grid-cols-3 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const items = (surveys ?? []).filter((s) => col.key.includes(s.status as SurveyStatus));
            return (
              <div key={col.label} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-[10px] uppercase tracking-wider font-medium">{col.label}</span>
                  <span className={`bg-bg-elevated text-text-secondary text-[10px] font-mono px-2 py-0.5 rounded-sm`}>
                    {String(items.length).padStart(2, "0")}
                  </span>
                </div>
                {items.length === 0 && (
                  <Panel><p className="text-text-muted text-[10px] text-center py-2">No surveys</p></Panel>
                )}
                {items.map((survey) => (
                  <Panel
                    key={survey.id}
                    className={selectedSurveyId === survey.id ? "border-primary/30" : ""}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <StatusBadge variant={col.variant}>{survey.status.replace(/_/g, " ").toUpperCase()}</StatusBadge>
                        <span className="text-text-muted text-[10px] font-mono">
                          {new Date(survey.survey_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-text-primary text-xs font-semibold">
                        Survey {survey.id.slice(0, 8)}
                      </p>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <AppButton
                            variant="outline"
                            size="sm"
                            fullWidth
                            onPress={() => setSelectedSurveyId(survey.id)}
                          >
                            Inspect
                          </AppButton>
                          <Link href={`/surveys/${survey.id}`} className="flex-1">
                            <AppButton variant="primary" size="sm" fullWidth>
                              View Detail
                            </AppButton>
                          </Link>
                        </div>
                        {/* QA action buttons based on current status */}
                        {survey.status === "pending" && (
                          <AppButton
                            variant="primary"
                            size="sm"
                            fullWidth
                            isDisabled={actionLoading === survey.id}
                            onPress={() => updateSurveyStatus(survey.id, "under_qa")}
                          >
                            {actionLoading === survey.id ? "Starting..." : "Start QA"}
                          </AppButton>
                        )}
                        {survey.status === "under_qa" && (
                          <div className="flex gap-2">
                            <AppButton
                              variant="outline"
                              size="sm"
                              fullWidth
                              isDisabled={actionLoading === survey.id}
                              onPress={() => updateSurveyStatus(survey.id, "pending")}
                            >
                              Reject
                            </AppButton>
                            <AppButton
                              variant="primary"
                              size="sm"
                              fullWidth
                              isDisabled={actionLoading === survey.id}
                              onPress={() => updateSurveyStatus(survey.id, "ready_to_approve")}
                            >
                              Mark Ready
                            </AppButton>
                          </div>
                        )}
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            );
          })}
        </div>

        {/* Detail sidebar */}
        <div className="col-span-4 flex flex-col gap-4">
          {selectedSurvey ? (
            <>
              <Panel noPadding>
                <div className="px-4 py-3 border-b border-border-subtle">
                  <span className="text-error text-[10px] uppercase tracking-wider font-medium">Detail View</span>
                  <h3 className="text-text-primary text-sm font-bold uppercase tracking-wider mt-1">
                    Survey {selectedSurvey.id.slice(0, 8)}
                  </h3>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[10px] uppercase tracking-wider">Status</span>
                    <StatusBadge variant="tag">{selectedSurvey.status.replace(/_/g, " ")}</StatusBadge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted text-[10px] uppercase tracking-wider">Date</span>
                    <span className="text-text-secondary text-xs font-mono">{new Date(selectedSurvey.survey_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </Panel>

              <Panel title="QA Checklist">
                <div className="flex flex-col gap-2">
                  {qaChecklist?.checklist && Array.isArray(qaChecklist.checklist) ? (
                    qaChecklist.checklist.map((item, i) => (
                      <label key={i} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" defaultChecked={item.checked} className="w-4 h-4 accent-primary" />
                        <span className="text-text-secondary text-xs font-mono uppercase tracking-wider">{item.label}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-text-muted text-[10px]">No checklist configured</p>
                  )}
                </div>
              </Panel>

              <Panel title="QA Log" headerAction={<span className="text-text-muted text-[10px] font-mono">{qaLog?.length ?? 0} entries</span>}>
                <div className="flex flex-col gap-3">
                  {(qaLog ?? []).slice(0, 5).map((entry) => (
                    <div key={entry.id} className="bg-bg-elevated rounded-sm p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-accent text-[10px] font-mono font-medium">{entry.actor_name}</span>
                        <span className="text-text-muted text-[10px] font-mono">{new Date(entry.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-text-secondary text-xs font-mono leading-relaxed">
                        {entry.comment || `${entry.action}: ${entry.previous_status ?? ""} → ${entry.new_status ?? ""}`}
                      </p>
                    </div>
                  ))}
                  {(qaLog ?? []).length === 0 && (
                    <p className="text-text-muted text-[10px]">No log entries</p>
                  )}
                </div>
              </Panel>
            </>
          ) : (
            <Panel>
              <p className="text-text-muted text-sm text-center py-8">Select a survey to inspect</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
