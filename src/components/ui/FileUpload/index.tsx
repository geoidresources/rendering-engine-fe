"use client";

import {
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { Upload, FileText, X } from "lucide-react";

// FileUploadHandle lets callers reset the component after a successful
// submit. Without this, /upload's "Initialize Ingest" flow left the staged
// file list in place while the parent store had already cleared — operators
// saw a stale "3 files selected" caption. Exposed via a ref prop (React 19).
export interface FileUploadHandle {
  clear: () => void;
}

interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  value?: File[];
  onChange?: (files: File[]) => void;
  className?: string;
  ref?: Ref<FileUploadHandle>;
}

export default function FileUpload({
  label = "Upload files",
  accept,
  multiple = true,
  maxSizeMB,
  value = [],
  onChange,
  className = "",
  ref,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>(value);
  const [isDragging, setIsDragging] = useState(false);

  useImperativeHandle(ref, () => ({
    clear: () => {
      setFiles([]);
      // <input type="file"> retains its value across re-renders; without
      // this reset, re-picking the same file wouldn't fire onChange.
      if (inputRef.current) inputRef.current.value = "";
      onChange?.([]);
    },
  }));

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
        <span className="text-text-muted text-xs font-medium uppercase tracking-wider px-1">
          {label}
        </span>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-3 rounded-sm border-2 border-dashed cursor-pointer
          transition-all p-10 text-center
          ${isDragging
            ? "border-primary bg-primary/10"
            : "border-border-subtle bg-bg-surface hover:border-text-muted"
          }
        `}
      >
        <div className="text-text-muted bg-bg-elevated p-3 rounded-sm">
          <Upload size={20} />
        </div>
        <div>
          <p className="text-text-secondary text-sm font-medium">
            Drag & drop files here, or <span className="text-primary">browse</span>
          </p>
          <p className="text-text-muted text-xs mt-1 font-mono uppercase tracking-wider">
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
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest px-1">
            Selected Files
          </p>
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-sm bg-bg-elevated border border-border-subtle p-3 group hover:border-text-muted transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-sm bg-bg-surface flex items-center justify-center text-text-muted">
                  <FileText size={16} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-text-primary text-xs font-semibold truncate leading-4 font-mono">
                    {f.name}
                  </span>
                  <span className="text-text-muted text-[10px] font-mono">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="text-text-muted hover:text-error transition-colors bg-transparent border-none cursor-pointer p-1"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
