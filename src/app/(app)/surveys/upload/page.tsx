"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  FileStack,
  Gauge,
  Loader2,
  Radar,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import FileUpload from "@/components/ui/FileUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useIngestPipeline } from "@/hooks/useIngestPipeline";
import { useProjects } from "@/hooks/useProjects";
import { useSurveys } from "@/hooks/useSurveys";
import { useUploadStore } from "@/store/uploadStore";
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

const fadeInUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function statusTone(status: string) {
  switch (status) {
    case "complete":
    case "approved":
    case "published":
      return "default" as const;
    case "error":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

export default function SurveyUploadPage() {
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [surveyDate, setSurveyDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [crs, setCrs] = useState("");
  const [sensor, setSensor] = useState(SENSOR_OPTIONS[0]);
  const [notes, setNotes] = useState("");

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const effectiveProjectId = selectedProjectId || projects?.[0]?.id || "";
  const selectedProject = useMemo(
    () => projects?.find((project) => project.id === effectiveProjectId),
    [effectiveProjectId, projects],
  );
  const effectiveCrs = crs || selectedProject?.settings?.crs || CRS_OPTIONS[0].value;

  const { data: surveys } = useSurveys(effectiveProjectId || undefined);
  const uploads = useUploadStore((state) => state.uploads);
  const surveyId = useUploadStore((state) => state.surveyId);
  const reset = useUploadStore((state) => state.reset);
  const queueFiles = useUploadStore((state) => state.queueFiles);
  const { startIngestion, isIngesting } = useIngestPipeline();

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects?.find((item) => item.id === projectId);
    setCrs(project?.settings?.crs || "");
  };

  const handleUpload = () => {
    if (!effectiveProjectId) {
      toast.error("Select a project");
      return;
    }

    if (uploads.length === 0) {
      toast.error("Add files first");
      return;
    }

    startIngestion({
      projectId: effectiveProjectId,
      surveyDate,
      crs: effectiveCrs,
      sensor,
      notes,
    });
  };

  const handleReset = () => {
    reset();
    setNotes("");
    setCrs("");
    setSurveyDate(new Date().toISOString().split("T")[0]);
  };

  const activeUploads = uploads.filter(
    (upload) => upload.status !== "complete" && upload.status !== "error" && upload.status !== "queued",
  );
  const inFlightUploads = uploads.filter(
    (upload) => upload.status !== "complete" && upload.status !== "error",
  );
  const processingFiles = uploads.filter((upload) => upload.status === "processing");
  const completedFiles = uploads.filter((upload) => upload.status === "complete");
  const errorFiles = uploads.filter((upload) => upload.status === "error");
  const queuedFiles = uploads.filter((upload) => upload.status === "queued");
  const allDone =
    uploads.length > 0 &&
    uploads.every((upload) => upload.status === "complete" || upload.status === "error");

  const totals = useMemo(() => {
    const totalBytes = uploads.reduce((sum, upload) => sum + upload.file.size, 0);
    const uploadedBytes = uploads.reduce((sum, upload) => sum + upload.bytesUploaded, 0);
    const averageProgress =
      uploads.length > 0
        ? Math.round(uploads.reduce((sum, upload) => sum + upload.progress, 0) / uploads.length)
        : 0;

    return {
      totalBytes,
      uploadedBytes,
      averageProgress,
    };
  }, [uploads]);

  return (
    <div className="min-h-full bg-gradient-to-b from-background via-background to-muted/20 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
          <div className="flex flex-col gap-6">
            <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.05 }}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UploadCloud className="size-5 text-primary" />
                    Survey files
                  </CardTitle>
                  <CardDescription>
                    Drag in point clouds, orthos, models, archives, and vector data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    label="Upload files"
                    accept=".las,.laz,.xyz,.e57,.tif,.tiff,.obj,.glb,.zip,.geojson"
                    onChange={(newFiles) => {
                      useUploadStore.getState().reset();
                      queueFiles(newFiles);
                    }}
                  />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.1 }}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Survey metadata</CardTitle>
                  <CardDescription>
                    Keep the ingest context complete before we send files to the pipeline.
                  </CardDescription>
                  <CardAction>
                    <Badge variant={effectiveProjectId ? "default" : "outline"}>
                      {effectiveProjectId ? "Project linked" : "Project required"}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="project-assignment">Project assignment</Label>
                      <Select
                        value={effectiveProjectId}
                        onValueChange={(value) => handleProjectChange(value || "")}
                        disabled={projectsLoading || !projects?.length}
                      >
                        <SelectTrigger className="w-full" aria-label="Project assignment">
                          <SelectValue
                            placeholder={
                              projectsLoading
                                ? "Loading projects..."
                                : !projects?.length
                                  ? "No projects available"
                                  : "Select project"
                            }
                          >
                            {selectedProject?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="survey-date">Survey date</Label>
                      <Input
                        id="survey-date"
                        type="date"
                        value={surveyDate}
                        onChange={(event) => setSurveyDate(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="crs">Coordinate reference system</Label>
                      <Select value={effectiveCrs} onValueChange={(value) => setCrs(value || "")}>
                        <SelectTrigger className="w-full" aria-label="Coordinate reference system">
                          <SelectValue placeholder="Select CRS" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sensor">Sensor hardware type</Label>
                      <Select value={sensor} onValueChange={(value) => setSensor(value || "")}>
                        <SelectTrigger className="w-full" aria-label="Sensor hardware type">
                          <SelectValue placeholder="Select sensor" />
                        </SelectTrigger>
                        <SelectContent>
                          {SENSOR_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ingestion-notes">Ingestion notes</Label>
                    <Textarea
                      id="ingestion-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Describe survey conditions, anomalies, or operator notes."
                      className="min-h-28 resize-none"
                    />
                  </div>

                  <div className="rounded-2xl border bg-muted/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {selectedProject?.name ?? "No project selected"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {effectiveCrs || "CRS pending"} • {sensor}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {isIngesting ? "Pipeline running" : "Ready to ingest"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button variant="outline" onClick={handleReset}>
                      Reset form
                    </Button>
                    <motion.div
                      whileHover={
                        uploads.length === 0 || !effectiveProjectId || isIngesting
                          ? undefined
                          : { y: -2, scale: 1.02 }
                      }
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <Button
                        onClick={handleUpload}
                        disabled={uploads.length === 0 || !effectiveProjectId || isIngesting}
                      >
                        {isIngesting && <Loader2 className="animate-spin" />}
                        Initialize ingest
                      </Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <AnimatePresence>
              {allDone && completedFiles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
                    <CardContent className="flex items-start gap-3 py-6">
                      <div className="rounded-full bg-emerald-500/15 p-2 text-emerald-500">
                        <CheckCircle2 className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Upload complete</p>
                        <p className="text-sm text-muted-foreground">
                          Successfully processed {completedFiles.length} file
                          {completedFiles.length !== 1 ? "s" : ""}
                          {errorFiles.length > 0 ? `. ${errorFiles.length} failed.` : "."}
                          {surveyId ? ` Survey ${surveyId.slice(0, 8)} created.` : ""}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-6">
            <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.15 }}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Upload activity</CardTitle>
                  <CardDescription>
                    Live status for queued, active, and recently processed files.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {/* Queued */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3 shadow-lg">
                      <p className="text-xs uppercase tracking-[0.18em] text-yellow-300/80">
                        Queued
                      </p>
                      <p className="mt-2 text-xl font-semibold text-yellow-200">
                        {queuedFiles.length}
                      </p>
                    </div>

                    {/* Active */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3 shadow-lg">
                      <p className="text-xs uppercase tracking-[0.18em] text-blue-300/80">
                        Active
                      </p>
                      <p className="mt-2 text-xl font-semibold text-blue-200">
                        {activeUploads.length}
                      </p>
                    </div>

                    {/* Done */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3 shadow-lg">
                      <p className="text-xs uppercase tracking-[0.18em] text-green-300/80">
                        Done
                      </p>
                      <p className="mt-2 text-xl font-semibold text-green-200">
                        {completedFiles.length}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Overall transfer</span>
                      <span className="font-medium">
                        {formatBytes(totals.uploadedBytes)} / {formatBytes(totals.totalBytes)}
                      </span>
                    </div>
                    <Progress value={totals.averageProgress} />
                  </div>

                  <AnimatePresence mode="popLayout">
                    {inFlightUploads.length === 0 ? (
                      <motion.div
                        key="empty-state"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground"
                      >
                        No active uploads yet.
                      </motion.div>
                    ) : (
                      inFlightUploads.map((upload, index) => (
                        <motion.div
                          key={`${upload.file.name}-${index}`}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="rounded-2xl border bg-background/80 p-4 shadow-sm"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{upload.file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {upload.status === "queued" && "Queued"}
                                {upload.status === "signing" && "Getting signed URL..."}
                                {upload.status === "uploading" &&
                                  `${formatBytes(upload.bytesUploaded)} of ${formatBytes(upload.file.size)} • ${formatSpeed(upload.speed)}`}
                                {upload.status === "creating" && "Creating asset record..."}
                                {upload.status === "processing" && "Processing triggered"}
                              </p>
                            </div>
                            <Badge variant={statusTone(upload.status)}>
                              {upload.status}
                            </Badge>
                          </div>
                          <Progress value={upload.status === "queued" ? 0 : upload.progress} />
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.2 }}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Pipeline notices</CardTitle>
                  <CardDescription>
                    Processing and error states stay visible while the ingest runs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {processingFiles.length === 0 && errorFiles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                      No warnings or processing events right now.
                    </div>
                  ) : (
                    <>
                      {processingFiles.map((file, index) => (
                        <motion.div
                          key={`${file.file.name}-processing-${index}`}
                          layout
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{file.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              The backend has accepted the upload and started processing.
                            </p>
                          </div>
                          <Badge variant="secondary">Processing</Badge>
                        </motion.div>
                      ))}

                      {errorFiles.map((file, index) => (
                        <motion.div
                          key={`${file.file.name}-error-${index}`}
                          layout
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4"
                        >
                          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium">{file.file.name}</p>
                            <p className="text-xs text-destructive/90">
                              {file.error || "Upload failed"}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.25 }}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Recent surveys</CardTitle>
                  <CardDescription>
                    Quick visibility into the latest survey records for this project.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!surveys?.length ? (
                    <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                      No surveys yet for the selected project.
                    </div>
                  ) : (
                    surveys.slice(0, 5).map((survey, index) => (
                      <motion.div
                        key={survey.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="rounded-2xl border bg-background/80 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Survey {survey.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(survey.survey_date).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={statusTone(survey.status)}>
                            {survey.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <Separator className="my-3" />
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          Status trail
                        </p>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
