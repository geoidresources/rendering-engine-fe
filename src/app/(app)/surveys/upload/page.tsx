"use client";

import { useState } from "react";
import PageShell from "@/components/ui/PageShell";
import FileUpload from "@/components/ui/FileUpload";
import { Button } from "@heroui/react";
import { Upload, CheckCircle2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";

export default function SurveyUploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpload = async () => {
    if (!files.length) return;

    try {
      setLoading(true);

      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      // 🔌 Replace with real API
      // await fetch("/api/upload", {
      //   method: "POST",
      //   body: formData,
      // });

      await new Promise((res) => setTimeout(res, 2000)); // mock
      setSuccess(true);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      title="Upload Files"
      description="Upload your survey or spatial data."
    >
      <div className="max-w-3xl mx-auto py-10 space-y-6">

        {/* Upload Section */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm transition-colors duration-300">
          <FileUpload
            label="Drop project files"
            accept=".tif,.las,.csv,.obj"
            onChange={(newFiles) => {
              setFiles(newFiles);
              setSuccess(false); // ✅ auto close success
            }}
          />
        </div>

        {/* Upload Button */}
        <div className="flex justify-end pt-4">
          <AppButton
            size="md"
            isLoading={loading}
            onPress={handleUpload}
            isDisabled={!files.length || loading}
            startIcon={!loading && <Upload size={18} />}
            className="px-8 py-6"
          >
            Start Upload
          </AppButton>
        </div>

        {success && (
          <div className="relative text-center py-10 px-6 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-3xl shadow-md animate-in zoom-in-95 duration-500">
            <button
              onClick={() => setSuccess(false)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              ✕
            </button>
            <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2
                size={32}
                className="text-emerald-600 dark:text-emerald-400"
              />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Upload Complete
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Successfully processed{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {files.length} {files.length === 1 ? "file" : "files"}
              </span>
            </p>
          </div>
        )}
      </div>
    </PageShell >
  );
}