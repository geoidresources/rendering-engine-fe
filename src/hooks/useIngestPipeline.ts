import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUploadStore } from "@/store/uploadStore";
import {
  createSurvey,
  getSignedUrl,
  uploadToGCS,
  createAsset,
  triggerGenerate,
  linkAssetsToSurvey,
} from "@/lib/api/assetSvcApi";

interface IngestParams {
  projectId: string;
  surveyDate: string;
  crs: string;
  sensor: string;
  notes: string;
}

export function useIngestPipeline() {
  const store = useUploadStore();
  const queryClient = useQueryClient();

  const startIngestion = useCallback(
    async (params: IngestParams) => {
      const { uploads } = useUploadStore.getState();
      if (uploads.length === 0) return;

      store.setIsIngesting(true);
      let surveyId: string;

      // Step A: Create the survey record
      try {
        const survey = await createSurvey({
          project_id: params.projectId,
          survey_date: params.surveyDate + "T00:00:00Z",
          metadata: {
            crs: params.crs,
            sensor: params.sensor,
            notes: params.notes,
          },
        });
        surveyId = survey.id;
        store.setSurveyId(surveyId);
      } catch (err: unknown) {
        // Surface the server body (e.g. validation errors from asset-svc)
        // instead of the generic "Failed to create survey record" — operators
        // need the reason in the toast so they can correct the form.
        const msg =
          (err as { data?: { error?: string }; message?: string })?.data?.error ??
          (err as { message?: string })?.message ??
          "Failed to create survey record";
        toast.error(msg);
        store.setIsIngesting(false);
        return;
      }

      // Step B: Process each file (max 3 concurrent)
      const successAssetIds: string[] = [];
      let failCount = 0;

      const processFile = async (idx: number) => {
        const { file } = useUploadStore.getState().uploads[idx];

        try {
          // B1: Get signed URL
          store.updateFile(idx, { status: "signing" });
          const { signedURL, resourceURL } = await getSignedUrl({
            file_name: file.name,
            asset_id: surveyId,
            type: "point_cloud",
          });
          store.updateFile(idx, { resourceUrl: resourceURL });

          // B2: Upload to GCS with progress tracking
          store.updateFile(idx, { status: "uploading" });
          let lastTime = Date.now();
          let lastLoaded = 0;
          await uploadToGCS(signedURL, file, (loaded, total) => {
            const now = Date.now();
            const dt = (now - lastTime) / 1000;
            const speed = dt > 0 ? (loaded - lastLoaded) / dt : 0;
            lastTime = now;
            lastLoaded = loaded;
            store.updateFile(idx, {
              progress: Math.round((loaded / total) * 100),
              bytesUploaded: loaded,
              speed,
            });
          });

          // B3: Create asset record
          store.updateFile(idx, { status: "creating", progress: 100 });
          const asset = await createAsset({
            name: file.name,
            type: "point_cloud",
            asset_url: resourceURL,
            project_id: params.projectId,
          });
          store.updateFile(idx, { assetId: asset.id });

          // B4: Trigger processing workflow
          store.updateFile(idx, { status: "processing" });
          await triggerGenerate(asset.id);

          store.updateFile(idx, { status: "complete" });
          successAssetIds.push(asset.id);
        } catch (err) {
          failCount++;
          store.updateFile(idx, {
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      };

      // Run with concurrency limit of 3
      const indices = uploads.map((_, i) => i);
      const CONCURRENCY = 3;
      for (let i = 0; i < indices.length; i += CONCURRENCY) {
        const batch = indices.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(processFile));
      }

      // Step C: Link successfully-uploaded assets to the survey
      if (successAssetIds.length > 0) {
        try {
          await linkAssetsToSurvey(surveyId, successAssetIds);
        } catch {
          toast.error("Assets uploaded but failed to link to survey");
        }
      }

      // Step D: Summary
      if (failCount === 0) {
        toast.success(`All ${uploads.length} file${uploads.length > 1 ? "s" : ""} ingested successfully`);
      } else {
        toast.warning(
          `${successAssetIds.length} of ${uploads.length} files succeeded. ${failCount} failed.`,
        );
      }

      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      store.setIsIngesting(false);
    },
    [store, queryClient],
  );

  return { startIngestion, isIngesting: store.isIngesting };
}
