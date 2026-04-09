"use client";

import { useState, useEffect } from "react";
import FileUpload from "@/components/ui/FileUpload";
import AppButton from "@/components/ui/AppButton";
import Panel from "@/components/ui/Panel";
import ProgressBar from "@/components/ui/ProgressBar";
import StatusBadge from "@/components/ui/StatusBadge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useSurveys } from "@/hooks/useSurveys";
import { useUploadStore } from "@/store/uploadStore";
import { useIngestPipeline } from "@/hooks/useIngestPipeline";
import { toast } from "sonner";

const CRS_OPTIONS = [
  { value: "EPSG:28356", label: "EPSG:28356 - GDA94 / MGA Zone 56" },
  { value: "EPSG:32756", label: "EPSG:32756 - WGS 84 / UTM Zone 56S" },
  { value: "EPSG:4326", label: "EPSG:4326 - WGS 84" },
  { value: "EPSG:7856", label: "EPSG:7856 - GDA2020 / MGA Zone 56" },
];

const SENSOR_OPTIONS = [
  "DJI Phantom 4 RTK",
  "DJI Matrice 300 RTK",
  "Leica BLK2FLY",
  "Leica RTC360",
  "FARO Focus S350",
  "Trimble X7",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/S`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/S`;
}

export default function SurveyUploadPage() {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [surveyDate, setSurveyDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [crs, setCrs] = useState("");
  const [sensor, setSensor] = useState(SENSOR_OPTIONS[0]);
  const [notes, setNotes] = useState("");

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: surveys } = useSurveys(selectedProjectId || undefined);
  const uploads = useUploadStore((s) => s.uploads);
  const surveyId = useUploadStore((s) => s.surveyId);
  const reset = useUploadStore((s) => s.reset);
  const queueFiles = useUploadStore((s) => s.queueFiles);
  const { startIngestion, isIngesting } = useIngestPipeline();

  // Auto-select first project
  useEffect(() => {
    if (!selectedProjectId && projects?.length) {
      setSelectedProjectId(projects[0].id);
    }
  }, [selectedProjectId, projects]);

  // Auto-set CRS from project settings
  useEffect(() => {
    if (selectedProjectId && projects) {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj?.settings?.crs) setCrs(proj.settings.crs);
    }
  }, [selectedProjectId, projects]);

  const handleUpload = () => {
    if (!selectedProjectId) {
      toast.error("Select a project");
      return;
    }
    if (uploads.length === 0) {
      toast.error("Add files first");
      return;
    }
    startIngestion({ projectId: selectedProjectId, surveyDate, crs, sensor, notes });
  };

  const handleReset = () => {
    reset();
    setNotes("");
    setSurveyDate(new Date().toISOString().split("T")[0]);
  };

  const activeUploads = uploads.filter(
    (u) => u.status !== "complete" && u.status !== "error" && u.status !== "queued",
  );
  const processingFiles = uploads.filter((u) => u.status === "processing");
  const completedFiles = uploads.filter((u) => u.status === "complete");
  const errorFiles = uploads.filter((u) => u.status === "error");
  const allDone = uploads.length > 0 && uploads.every((u) => u.status === "complete" || u.status === "error");

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-text-primary text-2xl font-bold uppercase tracking-wider">
          Data Ingestion Portal
        </h1>
        <p className="text-text-muted text-xs uppercase tracking-wider font-mono mt-1">
          {isIngesting
            ? `Uploading ${uploads.length} file${uploads.length > 1 ? "s" : ""}...`
            : "Upload survey data for processing"}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content — Left */}
        <div className="col-span-8 flex flex-col gap-6">
          {/* Upload Zone */}
          <Panel>
            <FileUpload
              label="Drag Lidar Sensor Data"
              accept=".las,.laz,.xyz,.e57,.tif,.tiff,.obj,.glb,.zip,.geojson"
              onChange={(newFiles) => {
                useUploadStore.getState().reset();
                queueFiles(newFiles);
              }}
            />
          </Panel>

          {/* Survey Metadata Schema */}
          <Panel
            title="Survey Metadata Schema"
            headerAction={
              selectedProjectId ? (
                <span className="text-primary text-[10px] uppercase tracking-wider font-medium">
                  Project Selected
                </span>
              ) : null
            }
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-text-muted text-[10px] uppercase tracking-wider">
                  Project Assignment
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-bg-elevated border border-border-subtle rounded-sm px-3 py-2.5 text-text-primary text-xs font-mono outline-none focus:border-primary"
                >
                  {projectsLoading ? (
                    <option>Loading projects...</option>
                  ) : !projects?.length ? (
                    <option>No projects available</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-text-muted text-[10px] uppercase tracking-wider">
                  Survey Date
                </label>
                <input
                  type="date"
                  value={surveyDate}
                  onChange={(e) => setSurveyDate(e.target.value)}
                  className="bg-bg-elevated border border-border-subtle rounded-sm px-3 py-2.5 text-text-primary text-xs font-mono outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-text-muted text-[10px] uppercase tracking-wider">
                  Coordinate Reference System (CRS)
                </label>
                <select
                  value={crs}
                  onChange={(e) => setCrs(e.target.value)}
                  className="bg-bg-elevated border border-border-subtle rounded-sm px-3 py-2.5 text-text-primary text-xs font-mono outline-none focus:border-primary"
                >
                  {CRS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-text-muted text-[10px] uppercase tracking-wider">
                  Sensor Hardware Type
                </label>
                <select
                  value={sensor}
                  onChange={(e) => setSensor(e.target.value)}
                  className="bg-bg-elevated border border-border-subtle rounded-sm px-3 py-2.5 text-text-primary text-xs font-mono outline-none focus:border-primary"
                >
                  {SENSOR_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1 mt-4">
              <label className="text-text-muted text-[10px] uppercase tracking-wider">
                Ingestion Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe survey conditions or data anomalies..."
                className="bg-bg-elevated border border-border-subtle rounded-sm px-3 py-2.5 text-text-primary text-xs font-mono outline-none focus:border-primary h-24 resize-none placeholder:text-text-muted"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <AppButton variant="outline" size="sm" onPress={handleReset}>
                Reset Form
              </AppButton>
              <AppButton
                variant="primary"
                size="sm"
                isLoading={isIngesting}
                onPress={handleUpload}
                isDisabled={uploads.length === 0 || !selectedProjectId}
              >
                Initialize Ingest
              </AppButton>
            </div>
          </Panel>

          {/* Success */}
          {allDone && completedFiles.length > 0 && (
            <Panel>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-success" />
                <div>
                  <p className="text-text-primary text-sm font-semibold">Upload Complete</p>
                  <p className="text-text-muted text-xs">
                    Successfully processed {completedFiles.length} file{completedFiles.length !== 1 ? "s" : ""}
                    {errorFiles.length > 0 && `. ${errorFiles.length} failed.`}
                    {surveyId && (
                      <span className="text-text-muted font-mono"> — Survey {surveyId.slice(0, 8)}</span>
                    )}
                  </p>
                </div>
              </div>
            </Panel>
          )}
        </div>

        {/* Sidebar — Right */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Active Uploads */}
          <Panel title="Active Uploads">
            {activeUploads.length === 0 && uploads.filter((u) => u.status === "queued").length === 0 ? (
              <p className="text-text-muted text-xs text-center py-2">No active uploads</p>
            ) : (
              <div className="flex flex-col gap-4">
                {uploads
                  .filter((u) => u.status !== "complete" && u.status !== "error")
                  .map((upload, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <p className="text-text-primary text-xs font-mono font-semibold truncate">
                        {upload.file.name}
                      </p>
                      <p className="text-text-muted text-[10px] font-mono">
                        {upload.status === "queued" && "Queued"}
                        {upload.status === "signing" && "Getting signed URL..."}
                        {upload.status === "uploading" &&
                          `${formatBytes(upload.bytesUploaded)} / ${formatBytes(upload.file.size)} — ${formatSpeed(upload.speed)}`}
                        {upload.status === "creating" && "Creating asset record..."}
                        {upload.status === "processing" && "Processing triggered"}
                      </p>
                      <ProgressBar
                        value={upload.status === "queued" ? 0 : upload.progress}
                        variant={upload.progress > 80 ? "success" : "primary"}
                        showPercentage
                      />
                    </div>
                  ))}
              </div>
            )}
          </Panel>

          {/* Processing Items */}
          {processingFiles.length > 0 &&
            processingFiles.map((f, i) => (
              <div key={i} className="bg-bg-surface border border-primary/30 rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <span className="text-text-primary text-xs font-mono truncate mr-2">
                    {f.file.name}
                  </span>
                  <StatusBadge variant="active">Processing</StatusBadge>
                </div>
              </div>
            ))}

          {/* Error Items */}
          {errorFiles.length > 0 &&
            errorFiles.map((f, i) => (
              <div key={i} className="bg-bg-surface border border-error/30 rounded-sm p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-error shrink-0" />
                  <div className="min-w-0">
                    <p className="text-text-primary text-xs font-mono truncate">{f.file.name}</p>
                    <p className="text-error text-[10px] font-mono">{f.error}</p>
                  </div>
                </div>
              </div>
            ))}

          {/* Storage / Latency */}
          <div className="grid grid-cols-2 gap-4">
            <Panel>
              <div className="flex flex-col gap-1">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">
                  Queued Files
                </span>
                <span className="text-primary text-2xl font-mono font-bold">{uploads.length}</span>
                <span className="text-text-muted text-[10px] font-mono">Total</span>
              </div>
            </Panel>
            <Panel>
              <div className="flex flex-col gap-1">
                <span className="text-text-muted text-[10px] uppercase tracking-wider">
                  Completed
                </span>
                <span className="text-success text-2xl font-mono font-bold">
                  {completedFiles.length}
                </span>
                <span className="text-text-muted text-[10px] font-mono">Files</span>
              </div>
            </Panel>
          </div>

          {/* Ingestion Log — Recent Surveys */}
          <Panel title="Recent Surveys">
            {!surveys?.length ? (
              <p className="text-text-muted text-xs text-center py-2">No surveys yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                {surveys.slice(0, 5).map((survey) => {
                  const variant =
                    survey.status === "approved" || survey.status === "published"
                      ? "success"
                      : survey.status === "processing"
                        ? "alert"
                        : "standby";
                  return (
                    <div key={survey.id} className="flex items-start gap-2">
                      <span
                        className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                          variant === "success"
                            ? "bg-success"
                            : variant === "alert"
                              ? "bg-accent"
                              : "bg-text-muted"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-text-secondary text-xs font-mono">
                          {survey.status.replace(/_/g, " ").toUpperCase()} — Survey{" "}
                          {survey.id.slice(0, 8)}
                        </p>
                        <p className="text-text-muted text-[10px] font-mono">
                          {new Date(survey.survey_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
