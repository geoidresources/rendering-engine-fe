/**
 * Right-side panel listing active anomaly alerts for the current site.
 * Shows severity badges, zone names, and descriptions with a max of 3 visible items.
 */
'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface AnomalyAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  zone?: string;
}

interface AnomalyAlertsProps {
  alerts: AnomalyAlert[];
  onReviewLog?: () => void;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  alert: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'ALERT' },
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'PENDING' },
  warning: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'PENDING' },
};

const DEFAULT_SEVERITY = { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'INFO' };

export const AnomalyAlerts: React.FC<AnomalyAlertsProps> = ({ alerts, onReviewLog }) => {
  const visible = alerts.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="w-72 rounded-lg bg-gray-900 border border-gray-700 shadow-lg shadow-black/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
        <AlertTriangle className="w-4 h-4 text-yellow-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-100">
          Anomaly Alerts
        </span>
        {alerts.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-gray-400">
            {alerts.length}
          </span>
        )}
      </div>

      {/* Alert list */}
      <ul className="divide-y divide-gray-800">
        {visible.map((alert) => {
          const style = SEVERITY_STYLES[alert.severity.toLowerCase()] ?? DEFAULT_SEVERITY;
          return (
            <li key={alert.id} className="px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}
                >
                  {style.label}
                </span>
                {alert.zone && (
                  <span className="text-[11px] font-mono font-medium text-gray-200 truncate">
                    {alert.zone}
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-snug text-gray-400">
                {alert.message}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Footer link */}
      <div className="px-4 py-2.5 border-t border-gray-800">
        <button
          type="button"
          onClick={onReviewLog}
          className="text-[10px] font-semibold uppercase tracking-wider text-yellow-500 hover:text-yellow-400 transition-colors"
        >
          Review Log &gt;
        </button>
      </div>
    </div>
  );
};
