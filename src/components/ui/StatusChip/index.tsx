import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "processing";

interface StatusChipProps {
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Pipeline-state marker used in tables, cards, and canvas overlays.
 * Extends the shadcn Badge `tag` variant with a wider semantic palette
 * (info / success / warning / danger / processing) aligned with the
 * mining-pipeline states we surface in QA, reconciliation, and survey
 * ingest. Prefer StatusChip for inline status — StatusBadge remains the
 * legacy 5-variant API used by the older HUD pages.
 */
const toneStyles: Record<StatusTone, { wrap: string; dot: string }> = {
  neutral: {
    wrap: "bg-bg-elevated text-text-secondary border-border-subtle",
    dot: "bg-text-muted",
  },
  info: {
    wrap: "bg-sky-500/10 text-sky-300 border-sky-500/25",
    dot: "bg-sky-400",
  },
  success: {
    wrap: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    dot: "bg-emerald-400",
  },
  warning: {
    wrap: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    dot: "bg-amber-400",
  },
  danger: {
    wrap: "bg-red-500/10 text-red-300 border-red-500/25",
    dot: "bg-red-400",
  },
  processing: {
    wrap: "bg-accent/10 text-accent border-accent/25",
    dot: "bg-accent animate-pulse",
  },
};

export default function StatusChip({
  tone = "neutral",
  dot = true,
  className,
  children,
}: StatusChipProps) {
  const style = toneStyles[tone];
  return (
    <Badge variant="tag" className={cn(style.wrap, className)}>
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
      )}
      {children}
    </Badge>
  );
}
