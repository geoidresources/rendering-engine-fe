/**
 * Small bar chart panel showing site distribution across categories.
 * Pure CSS horizontal bars -- no chart library required.
 */
'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card';

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
    <Card className="w-72 border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </div>
          <CardTitle className="text-sm">Site Distribution</CardTitle>
        </div>
        <Badge variant="outline" className="font-mono uppercase">
          Year: {year}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-2.5">
        {data.map((item) => {
          const pct = Math.round((item.value / maxValue) * 100);
          return (
            <div key={item.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="truncate text-[11px] font-medium text-foreground">
                  {item.label}
                </span>
                <span className="ml-2 shrink-0 text-[10px] font-mono text-muted-foreground">
                  {item.value.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
