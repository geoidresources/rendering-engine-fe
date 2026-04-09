/**
 * Floating right-side panel showing analytics for a selected zone polygon.
 * Displays volume, mass, survey date, and an export action.
 */
'use client';

import React from 'react';
import { Download, MapPin } from 'lucide-react';

export interface ZoneData {
  id: string;
  name: string;
  volumeM3: number;
  massT: number;
  lastSurveyed: string;
  areaM2: number;
}

interface ZoneAnalyticsPanelProps {
  zone: ZoneData | null;
  processingProgress?: number;
  onExport?: () => void;
}

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export const ZoneAnalyticsPanel: React.FC<ZoneAnalyticsPanelProps> = ({
  zone,
  processingProgress,
  onExport,
}) => {
  if (!zone) return null;

  const progress = processingProgress ?? 100;
  const isProcessing = progress < 100;

  return (
    <div className="w-72 rounded-lg bg-gray-900 border border-gray-700 shadow-lg shadow-black/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
        <MapPin className="w-4 h-4 text-yellow-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-100">
          Zone Analytics
        </span>
        <span className="ml-auto inline-block rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold font-mono text-yellow-400">
          {zone.id}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-px bg-gray-800">
        <MetricCell label="Est. Volume" value={formatNumber(zone.volumeM3)} unit="m\u00B3" />
        <MetricCell label="Mass Estimate" value={formatNumber(zone.massT)} unit="t" />
        <MetricCell label="Surface Area" value={formatNumber(zone.areaM2)} unit="m\u00B2" />
        <MetricCell label="Last Surveyed" value={zone.lastSurveyed} />
      </div>

      {/* Processing progress */}
      {isProcessing && (
        <div className="px-4 py-3 border-t border-gray-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Processing
            </span>
            <span className="text-[10px] font-mono text-gray-400">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-yellow-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Export button */}
      <div className="px-4 py-3 border-t border-gray-800">
        <button
          type="button"
          onClick={onExport}
          disabled={isProcessing}
          className="flex w-full items-center justify-center gap-2 rounded bg-yellow-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-900 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export Point Cloud (LAZ)
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

interface MetricCellProps {
  label: string;
  value: string;
  unit?: string;
}

const MetricCell: React.FC<MetricCellProps> = ({ label, value, unit }) => (
  <div className="bg-gray-900 px-4 py-3 flex flex-col gap-0.5">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
      {label}
    </span>
    <span className="text-sm font-mono font-medium text-gray-100">
      {value}
      {unit && <span className="text-[10px] text-gray-400 ml-1">{unit}</span>}
    </span>
  </div>
);
