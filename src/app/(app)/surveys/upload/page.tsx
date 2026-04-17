"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import FileUpload, { type FileUploadHandle } from "@/components/ui/FileUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, FolderPlus, Loader2 } from "lucide-react";
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
  const fileUploadRef = useRef<FileUploadHandle>(null);

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

  const handleUpload = async () => {
    if (!selectedProjectId) {
      toast.error("Select a project");
      return;
    }
    if (uploads.length === 0) {
      toast.error("Add files first");
      return;
    }
    if (!surveyDate) {
      toast.error("Survey date is required");
      return;
    }
    try {
      await startIngestion({ projectId: selectedProjectId, surveyDate, crs, sensor, notes });
    } catch (err: unknown) {
      // startIngestion already surfaces most failures inline (survey-create,
      // per-file errors). This catch is the backstop for unexpected throws —
      // we surface the server body so 4xx/5xx from asset-svc isn't swallowed.
      const msg =
        (err as { data?: { error?: string }; message?: string })?.data?.error ??
        (err as { message?: string })?.message ??
        "Ingest failed";
      toast.error(msg);
    }
  };

  const handleReset = () => {
    reset();
    setNotes("");
    setSurveyDate(new Date().toISOString().split("T")[0]);
    // FileUpload holds its own staged-file list; without this the count on
    // the tile reads "No active uploads" from the store while the dropzone
    // still shows the old selection.
    fileUploadRef.current?.clear();
  };

  const activeUploads = uploads.filter(
    (u) => u.status !== "complete" && u.status !== "error" && u.status !== "queued",
  );
  const processingFiles = uploads.filter((u) => u.status === "processing");
  const completedFiles = uploads.filter((u) => u.status === "complete");
  const errorFiles = uploads.filter((u) => u.status === "error");
  const allDone = uploads.length > 0 && uploads.every((u) => u.status === "complete" || u.status === "error");

  const hasNoProjects = !projectsLoading && !projects?.length;

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-2xl font-bold uppercase tracking-wider">
          Data Ingestion Portal
        </h1>
        <p className="text-muted-foreground text-xs uppercase tracking-wider font-mono mt-1">
          {isIngesting
            ? `Uploading ${uploads.length} file${uploads.length > 1 ? "s" : ""}...`
            : "Upload survey data for processing"}
        </p>
      </div>

      {hasNoProjects ? (
        // Blocking empty-state. Without a project the ingest pipeline cannot
        // create a survey row — rendering the form at all would let the user
        // stage files that are guaranteed to fail on submit.
        <Card className="rounded-sm ring-0 gap-0 py-0">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="rounded-sm bg-secondary p-3 text-muted-foreground">
              <FolderPlus size={24} />
            </div>
            <p className="text-foreground text-sm font-semibold">
              Create a project first
            </p>
            <p className="text-muted-foreground text-xs max-w-sm">
              Surveys live inside projects. Set up a project before ingesting
              data so the survey, CRS, and stockpile analytics have a home.
            </p>
            <Button size="sm" className="mt-2" render={<Link href="/projects" />}>
              Go to projects
            </Button>
          </CardContent>
        </Card>
      ) : (
      <div className="grid grid-cols-12 gap-6">
        {/* Main Content — Left */}
        <div className="col-span-8 flex flex-col gap-6">
          {/* Upload Zone */}
          <Card className="rounded-sm ring-0 gap-0 py-0">
            <CardContent className="p-6">
              <FileUpload
                ref={fileUploadRef}
                label="Drag Lidar Sensor Data"
                accept=".las,.laz,.xyz,.e57,.tif,.tiff,.obj,.glb,.zip,.geojson"
                onChange={(newFiles) => {
                  useUploadStore.getState().reset();
                  queueFiles(newFiles);
                }}
              />
            </CardContent>
          </Card>

          {/* Survey Metadata Schema */}
          <Card className="rounded-sm ring-0 gap-0 py-0">
            <CardHeader className="flex flex-row items-center justify-between px-6 py-3 border-b">
              <CardTitle className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                Survey Metadata Schema
              </CardTitle>
              {selectedProjectId && (
                <span className="text-primary text-[10px] uppercase tracking-wider font-medium font-mono">
                  Project Selected
                </span>
              )}
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">
                    Project Assignment
                  </Label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={(v) => setSelectedProjectId(v ?? "")}
                    disabled={projectsLoading || !projects?.length}
                  >
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Select a project"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="font-mono text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">
                    Survey Date
                  </Label>
                  <Input
                    type="date"
                    value={surveyDate}
                    onChange={(e) => setSurveyDate(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">
                    Coordinate Reference System (CRS)
                  </Label>
                  <Select value={crs} onValueChange={(v) => setCrs(v ?? "")}>
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Select CRS" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="font-mono text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">
                    Sensor Hardware Type
                  </Label>
                  <Select value={sensor} onValueChange={(v) => setSensor(v ?? SENSOR_OPTIONS[0])}>
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Select sensor" />
                    </SelectTrigger>
                    <SelectContent>
                      {SENSOR_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="font-mono text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-4">
                <Label className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  Ingestion Notes
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe survey conditions or data anomalies..."
                  className="font-mono text-xs h-24 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reset Form
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={
                    isIngesting ||
                    uploads.length === 0 ||
                    !selectedProjectId ||
                    !surveyDate
                  }
                >
                  {isIngesting && <Loader2 className="animate-spin size-3.5" />}
                  {isIngesting ? "Processing…" : "Initialize Ingest"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Success */}
          {allDone && completedFiles.length > 0 && (
            <Card className="rounded-sm ring-0 gap-0 py-0">
              <CardContent className="p-6 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-success" />
                <div>
                  <p className="text-foreground text-sm font-semibold">Upload Complete</p>
                  <p className="text-muted-foreground text-xs">
                    Successfully processed {completedFiles.length} file{completedFiles.length !== 1 ? "s" : ""}
                    {errorFiles.length > 0 && `. ${errorFiles.length} failed.`}
                    {surveyId && (
                      <span className="text-muted-foreground font-mono"> — Survey {surveyId.slice(0, 8)}</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — Right */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Active Uploads */}
          <Card className="rounded-sm ring-0 gap-0 py-0">
            <CardHeader className="px-6 py-3 border-b">
              <CardTitle className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                Active Uploads
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {activeUploads.length === 0 && uploads.filter((u) => u.status === "queued").length === 0 ? (
                <p className="text-muted-foreground text-xs text-center py-2">No active uploads</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {uploads
                    .filter((u) => u.status !== "complete" && u.status !== "error")
                    .map((upload, i) => {
                      const pct = upload.status === "queued" ? 0 : upload.progress;
                      const indicatorColor =
                        pct > 80
                          ? "[&_[data-slot=progress-indicator]]:bg-success"
                          : "[&_[data-slot=progress-indicator]]:bg-primary";
                      return (
                        <div key={i} className="flex flex-col gap-2">
                          <p className="text-foreground text-xs font-mono font-semibold truncate">
                            {upload.file.name}
                          </p>
                          <p className="text-muted-foreground text-[10px] font-mono">
                            {upload.status === "queued" && "Queued"}
                            {upload.status === "signing" && "Getting signed URL..."}
                            {upload.status === "uploading" &&
                              `${formatBytes(upload.bytesUploaded)} / ${formatBytes(upload.file.size)} — ${formatSpeed(upload.speed)}`}
                            {upload.status === "creating" && "Creating asset record..."}
                            {upload.status === "processing" && "Processing triggered"}
                          </p>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className={`flex-1 ${indicatorColor}`} />
                            <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                              {Math.round(pct)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Processing Items */}
          {processingFiles.length > 0 &&
            processingFiles.map((f, i) => (
              <div key={i} className="bg-card border border-primary/30 rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-xs font-mono truncate mr-2">
                    {f.file.name}
                  </span>
                  <Badge variant="active">Processing</Badge>
                </div>
              </div>
            ))}

          {/* Error Items */}
          {errorFiles.length > 0 &&
            errorFiles.map((f, i) => (
              <div key={i} className="bg-card border border-destructive/30 rounded-sm p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-destructive shrink-0" />
                  <div className="min-w-0">
                    <p className="text-foreground text-xs font-mono truncate">{f.file.name}</p>
                    <p className="text-destructive text-[10px] font-mono">{f.error}</p>
                  </div>
                </div>
              </div>
            ))}

          {/* Storage / Latency */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="rounded-sm ring-0 gap-0 py-0">
              <CardContent className="p-6">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                    Queued Files
                  </span>
                  <span className="text-primary text-2xl font-mono font-bold">{uploads.length}</span>
                  <span className="text-muted-foreground text-[10px] font-mono">Total</span>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-sm ring-0 gap-0 py-0">
              <CardContent className="p-6">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                    Completed
                  </span>
                  <span className="text-success text-2xl font-mono font-bold">
                    {completedFiles.length}
                  </span>
                  <span className="text-muted-foreground text-[10px] font-mono">Files</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ingestion Log — Recent Surveys */}
          <Card className="rounded-sm ring-0 gap-0 py-0">
            <CardHeader className="px-6 py-3 border-b">
              <CardTitle className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                Recent Surveys
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!surveys?.length ? (
                <p className="text-muted-foreground text-xs text-center py-2">No surveys yet</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {surveys.slice(0, 5).map((survey) => {
                    const dot =
                      survey.status === "approved" || survey.status === "published"
                        ? "bg-success"
                        : survey.status === "processing"
                          ? "bg-accent"
                          : "bg-muted-foreground";
                    return (
                      <Link
                        key={survey.id}
                        href={`/surveys/${survey.id}`}
                        className="flex items-start gap-2 rounded-sm -mx-1 px-1 py-1 hover:bg-secondary transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground/80 text-xs font-mono">
                            {survey.status.replace(/_/g, " ").toUpperCase()} — Survey{" "}
                            {survey.id.slice(0, 8)}
                          </p>
                          <p className="text-muted-foreground text-[10px] font-mono">
                            {new Date(survey.survey_date).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
