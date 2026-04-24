'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ThresholdBreach } from '@/hooks/useViewerThresholdAlerts';

interface RegionAlertTooltipProps {
  breach: ThresholdBreach;
}

/**
 * V-TASK-05 — Alert badge rendered next to saved-region cards that have
 * crossed a threshold. Displays severity icon + brief copy.
 */
export function RegionAlertTooltip({ breach }: RegionAlertTooltipProps) {
  const isRed = breach.severity === 'red';
  return (
    <span
      title={`Exceeded ${breach.thresholdPct.toFixed(0)}% threshold on ${breach.detectedAt.slice(0, 10)}`}
      className={`shrink-0 inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] border ${
        isRed
          ? 'bg-red-500/10 text-red-400 border-red-500/30'
          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
      }`}
    >
      <AlertTriangle className="size-2.5" />
      {isRed ? 'Alert' : 'Warning'}
    </span>
  );
}
