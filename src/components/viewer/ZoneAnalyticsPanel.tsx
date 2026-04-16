/**
 * Floating right-side panel showing analytics for a selected zone polygon.
 * Displays volume, mass, survey date, and an export action.
 */
'use client';

import React from 'react';
import { Download, MapPin } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';

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
    <Card className="w-72 border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="size-4" />
          </div>
          <CardTitle className="text-sm">Zone Analytics</CardTitle>
          <Badge variant="outline" className="ml-auto font-mono">
          {zone.id}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-2">
        <MetricCell label="Est. Volume" value={formatNumber(zone.volumeM3)} unit="m\u00B3" />
        <MetricCell label="Mass Estimate" value={formatNumber(zone.massT)} unit="t" />
        <MetricCell label="Surface Area" value={formatNumber(zone.areaM2)} unit="m\u00B2" />
        <MetricCell label="Last Surveyed" value={zone.lastSurveyed} />
      </CardContent>

      {isProcessing && (
        <CardContent className="border-t pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Processing
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      )}

      <CardFooter>
        <Button
          type="button"
          onClick={onExport}
          disabled={isProcessing}
          className="w-full text-[11px] uppercase tracking-wider"
        >
          <Download className="size-3.5" />
          Export Point Cloud (LAZ)
        </Button>
      </CardFooter>
    </Card>
  );
};

/* ------------------------------------------------------------------ */

interface MetricCellProps {
  label: string;
  value: string;
  unit?: string;
}

const MetricCell: React.FC<MetricCellProps> = ({ label, value, unit }) => (
  <div className="flex flex-col gap-0.5 rounded-xl border bg-card px-4 py-3">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <span className="text-sm font-mono font-medium text-foreground">
      {value}
      {unit && <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span>}
    </span>
  </div>
);
