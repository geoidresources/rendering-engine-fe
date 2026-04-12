"use client";

import React, { useState } from "react";

interface BarDataPoint {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  data: BarDataPoint[];
  activeIndex?: number;
  height?: number;
  className?: string;
}

export default function MiniBarChart({
  data,
  activeIndex,
  height = 220,
  className = "",
}: MiniBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const padTop = 16;
  const padBottom = 28;
  const padLeft = 36;
  const padRight = 8;
  const chartW = 600;
  const chartH = height - padTop - padBottom;
  const barGap = 10;
  const usableW = chartW - padLeft - padRight;
  const barW = (usableW - barGap * (data.length + 1)) / data.length;
  const gridCount = 4;
  const radius = 4;

  const ticks = Array.from({ length: gridCount + 1 }, (_, i) =>
    Math.round((maxValue / gridCount) * i),
  );

  return (
    <div className={className}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${chartW} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {ticks.map((tick) => {
          const y = padTop + chartH - (tick / maxValue) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={chartW - padRight}
                y2={y}
                stroke="var(--border-subtle)"
                strokeDasharray="2 4"
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize={9}
                fontFamily="var(--font-jetbrains-mono)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const x = padLeft + barGap + i * (barW + barGap);
          const barH = Math.max((d.value / maxValue) * chartH, 2);
          const y = padTop + chartH - barH;
          const isActive = i === activeIndex;
          const isHovered = i === hoveredIndex;

          return (
            <g
              key={d.label}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={radius}
                ry={radius}
                fill={
                  isActive || isHovered
                    ? "var(--color-primary)"
                    : "var(--bg-elevated)"
                }
                opacity={isHovered && !isActive ? 0.8 : 1}
                style={{ transition: "opacity 150ms, fill 150ms" }}
              />

              {isHovered && (
                <text
                  x={x + barW / 2}
                  y={y - 8}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize={11}
                  fontFamily="var(--font-jetbrains-mono)"
                  fontWeight={600}
                >
                  {d.value}
                </text>
              )}

              <text
                x={x + barW / 2}
                y={padTop + chartH + 18}
                textAnchor="middle"
                fill={
                  isActive || isHovered
                    ? "var(--text-primary)"
                    : "var(--text-muted)"
                }
                fontSize={9}
                fontFamily="var(--font-jetbrains-mono)"
                style={{ textTransform: "uppercase" }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
