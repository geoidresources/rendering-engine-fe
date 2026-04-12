import React from "react";

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  variant?: "primary" | "success" | "warning" | "critical";
  label?: string;
  className?: string;
}

const strokeColors: Record<NonNullable<CircularProgressProps["variant"]>, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  critical: "var(--color-error)",
};

export default function CircularProgress({
  value,
  size = 80,
  strokeWidth = 6,
  variant = "primary",
  label,
  className = "",
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={strokeColors[variant]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-text-primary text-lg font-mono font-bold">
            {Math.round(clamped)}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-text-muted text-[10px] uppercase tracking-wider font-medium">
          {label}
        </span>
      )}
    </div>
  );
}
