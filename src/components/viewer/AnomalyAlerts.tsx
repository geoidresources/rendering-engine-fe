/**
 * Right-side panel listing active anomaly alerts for the current site.
 * Shows severity badges, zone names, and descriptions with a max of 3 visible items.
 */
'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';

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

const SEVERITY_STYLES: Record<string, { variant: 'destructive' | 'secondary' | 'outline'; label: string }> = {
  alert: { variant: 'destructive', label: 'ALERT' },
  pending: { variant: 'secondary', label: 'PENDING' },
  warning: { variant: 'secondary', label: 'PENDING' },
};

const DEFAULT_SEVERITY = { variant: 'outline' as const, label: 'INFO' };

export const AnomalyAlerts: React.FC<AnomalyAlertsProps> = ({ alerts, onReviewLog }) => {
  const visible = alerts.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <Card className="w-72 border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <AlertTriangle className="size-4" />
          </div>
          <CardTitle className="text-sm">Anomaly Alerts</CardTitle>
          {alerts.length > 0 && (
            <Badge variant="outline" className="ml-auto font-mono">
              {alerts.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="divide-y">
        {visible.map((alert) => {
          const style = SEVERITY_STYLES[alert.severity.toLowerCase()] ?? DEFAULT_SEVERITY;
          return (
            <div key={alert.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Badge variant={style.variant} className="uppercase">
                  {style.label}
                </Badge>
                {alert.zone && <span className="truncate text-[11px] font-medium">{alert.zone}</span>}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{alert.message}</p>
            </div>
          );
        })}
      </CardContent>

      <CardFooter>
        <Button
          type="button"
          onClick={onReviewLog}
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-[11px] uppercase tracking-wider text-primary hover:text-primary"
        >
          Review Log &gt;
        </Button>
      </CardFooter>
    </Card>
  );
};
