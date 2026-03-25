"use client";

import { useRef, useState } from "react";
import { Button } from "@heroui/react";

interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
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
  onChange,
  className = "",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
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
        <span className="text-zinc-400 text-xs font-medium">{label}</span>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer
          transition-colors p-6 text-center
          ${isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-600 hover:bg-zinc-800/60"
          }
        `}
      >
        <div className="text-zinc-500">
          <UploadIcon />
        </div>
        <p className="text-zinc-400 text-xs">
          Drag & drop files here, or{" "}
          <span className="text-blue-400 hover:text-blue-300">browse</span>
        </p>
        {accept && (
          <p className="text-zinc-600 text-xs">{accept.replace(/,/g, ", ")}</p>
        )}
        {maxSizeMB && (
          <p className="text-zinc-600 text-xs">Max {maxSizeMB} MB per file</p>
        )}
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
        <div className="flex flex-col gap-1 mt-1">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800/60 border border-zinc-700 px-3 py-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-white text-xs truncate">{f.name}</span>
                <span className="text-zinc-500 text-xs">
                  {(f.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="bg-transparent text-zinc-500 hover:text-red-400 hover:bg-transparent min-w-unit-6 w-6 h-6"
                onPress={() => removeFile(i)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
