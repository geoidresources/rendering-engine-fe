"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type SurveyStatus = "pending" | "processing" | "approved" | "published" | "locked";

interface SurveyStatusBadgeProps {
  status: SurveyStatus;
  className?: string;
}

const dotColor: Record<SurveyStatus, string> = {
  pending:    "bg-amber-400",
  processing: "bg-blue-400",
  approved:   "bg-teal-400",
  published:  "bg-primary",
  locked:     "bg-muted-foreground",
};

const pillClass: Record<SurveyStatus, string> = {
  pending:    "bg-amber-400/10 text-amber-400 border-amber-400/20",
  processing: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  approved:   "bg-teal-400/10 text-teal-400 border-teal-400/20",
  published:  "bg-primary/10 text-primary border-primary/20",
  locked:     "bg-secondary text-muted-foreground border-border",
};

export default function SurveyStatusBadge({ status, className }: SurveyStatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "inline-flex h-auto items-center gap-1.5 rounded-sm border",
        "text-[10px] uppercase tracking-wider font-mono font-medium",
        "px-2 py-0.5",
        pillClass[status] ?? "bg-secondary text-muted-foreground border-border",
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor[status] ?? "bg-muted-foreground")} />
      {status}
    </Badge>
  );
}
