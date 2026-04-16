"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Sparkles, Upload, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  value?: File[];
  onChange?: (files: File[]) => void;
  className?: string;
}

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
    <div className={cn("flex flex-col gap-3", className)}>
      {label && (
        <span className="px-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      )}

      <motion.div
        whileHover={{ y: -2 }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-3xl border border-dashed bg-gradient-to-br from-background to-muted/30 p-10 text-center transition-all duration-200",
          isDragging
            ? "border-primary bg-primary/5 shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
            : "border-border/70 hover:border-primary/40 hover:bg-muted/30",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-background/80 text-primary shadow-sm">
          <Upload size={22} />
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-base font-medium text-foreground">
            Drag and drop files here, or <span className="text-primary">browse</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {accept ? `Supports ${accept.replace(/,/g, ", ").toUpperCase()}` : "Any file format supported"}
            {maxSizeMB && ` (Max ${maxSizeMB}MB)`}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Badge variant="outline">Multi-file</Badge>
          <Badge variant="secondary">
            <Sparkles className="size-3" />
            Ready for ingest
          </Badge>
        </div>
      </motion.div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {files.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Selected files
          </p>
          {files.map((f, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 rounded-2xl border bg-background/80 p-3 shadow-sm transition-colors hover:border-primary/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground">
                  <FileText size={16} />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium leading-4 text-foreground">
                    {f.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
              >
                <X size={14} />
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
