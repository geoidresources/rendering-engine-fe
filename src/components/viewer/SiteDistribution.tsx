/**
 * Small bar chart panel showing site distribution across categories.
 * Pure CSS horizontal bars -- no chart library required.
 */
'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';

export interface SiteDistributionItem {
  label: string;
  value: number;
  color: string;
}

interface SiteDistributionProps {
  data: SiteDistributionItem[];
  year?: string;
}

export const SiteDistribution: React.FC<SiteDistributionProps> = ({
  data,
  year = 'ALL',
}) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-72 rounded-lg bg-gray-900 border border-gray-700 shadow-lg shadow-black/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-100">
            Site Distribution
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase text-gray-400">
          Year: {year}
        </span>
      </div>

      {/* Bar chart */}
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {data.map((item) => {
          const pct = Math.round((item.value / maxValue) * 100);
          return (
            <div key={item.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-300 truncate">
                  {item.label}
                </span>
                <span className="text-[10px] font-mono text-gray-400 ml-2 shrink-0">
                  {item.value.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
