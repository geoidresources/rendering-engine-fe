import React from "react";

interface ProgressBarProps {
  value: number;
  variant?: "primary" | "success" | "warning" | "critical";
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

const fillColors: Record<NonNullable<ProgressBarProps["variant"]>, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-error",
};

export default function ProgressBar({
  value,
  variant = "primary",
  label,
  showPercentage = false,
  className = "",
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-text-muted text-[10px] uppercase tracking-wider font-medium">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-text-secondary font-mono text-[10px]">
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}
      <div className="w-full bg-bg-elevated h-1.5 rounded-sm overflow-hidden">
        <div
          className={`h-full rounded-sm transition-all duration-300 ${fillColors[variant]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
