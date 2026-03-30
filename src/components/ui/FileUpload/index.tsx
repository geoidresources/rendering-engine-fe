"use client";

import { useRef, useState } from "react";
import AppButton from "@/components/ui/AppButton";

interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  value?: File[];
  onChange?: (files: File[]) => void;
  className?: string;
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/**
 * Global FileUpload — drag-and-drop or click-to-browse, with file list preview.
 */
export default function FileUpload({
  label = "Upload files",
  accept,
  multiple = true,
  maxSizeMB,
  value = [],
  onChange,
  className = "",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>(value);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return;
    const arr = Array.from(incoming);
    const filtered = maxSizeMB
      ? arr.filter((f) => f.size <= maxSizeMB * 1024 * 1024)
      : arr;
    const combined = multiple ? [...files, ...filtered] : filtered;
    setFiles(combined);
    onChange?.(combined);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onChange?.(next);
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium px-1 leading-6">{label}</span>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer
          transition-all p-10 text-center
          ${isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
          }
        `}
      >
        <div className="text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-800 p-3 rounded-full shadow-sm">
          <UploadIcon />
        </div>
        <div>
          <p className="text-zinc-900 dark:text-zinc-300 text-sm font-medium">
            Drag & drop files here, or <span className="text-blue-600 dark:text-blue-400">browse</span>
          </p>
          <p className="text-zinc-500 dark:text-zinc-500 text-xs mt-1">
            {accept ? `Supports ${accept.replace(/,/g, ", ").toUpperCase()}` : "Any file format supported"}
            {maxSizeMB && ` (Max ${maxSizeMB}MB)`}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2 mt-4">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">Selected Files</p>
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 p-3 shadow-sm group hover:border-zinc-300 dark:hover:border-zinc-500 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-zinc-900 dark:text-zinc-100 text-xs font-semibold truncate leading-4">{f.name}</span>
                  <span className="text-zinc-500 text-[10px] font-medium">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
              <AppButton
                size="sm"
                variant="ghost"
                className="w-8 h-8 rounded-lg !px-0 bg-transparent"
                onPress={() => removeFile(i)}
                startIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
              >
                {""}
              </AppButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
