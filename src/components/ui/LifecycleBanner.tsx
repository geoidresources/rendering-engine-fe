'use client';

import React, { useState } from 'react';
import { AlertTriangle, Info, Lock, Archive, X } from 'lucide-react';
import { useActiveProject } from '@/store/projectStore';
import type { ProjectRecord } from '@/store/projectStore';
import { cn } from '@/lib/utils';

type NonActiveStatus = Exclude<ProjectRecord['lifecycle_status'], 'active'>;

interface BannerConfig {
  bg: string;
  text: string;
  icon: React.ReactNode;
  message: string;
}

const BANNER_CONFIG: Record<NonActiveStatus, BannerConfig> = {
  suspended: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-400',
    icon: <AlertTriangle className="size-3 shrink-0" />,
    message: 'This project is suspended. Contact your administrator to resume.',
  },
  review: {
    bg: 'bg-blue-500/10 border-blue-500/30',
    text: 'text-blue-400',
    icon: <Info className="size-3 shrink-0" />,
    message: 'This project is under review. Editing is restricted until review is complete.',
  },
  completed: {
    bg: 'bg-muted/40 border-border-subtle',
    text: 'text-muted-foreground',
    icon: <Lock className="size-3 shrink-0" />,
    message: 'This project is completed and read-only.',
  },
  archived: {
    bg: 'bg-muted/20 border-border-subtle',
    text: 'text-muted-foreground/70',
    icon: <Archive className="size-3 shrink-0" />,
    message: 'This project is archived. Data is available for viewing only.',
  },
};

export function LifecycleBanner() {
  const { project } = useActiveProject();
  const [dismissed, setDismissed] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('lifecycle-banner-dismissed');
  });

  const status = project?.lifecycle_status;

  if (!status || status === 'active') return null;
  if (dismissed === `${project?.id}:${status}`) return null;

  const config = BANNER_CONFIG[status];

  const handleDismiss = () => {
    const key = `${project?.id}:${status}`;
    sessionStorage.setItem('lifecycle-banner-dismissed', key);
    setDismissed(key);
  };

  return (
    <div
      className={cn(
        'flex h-9 items-center justify-between gap-2 border-b px-4',
        config.bg,
      )}
    >
      <div className={cn('flex items-center gap-2 text-xs', config.text)}>
        {config.icon}
        <span className="font-mono">{config.message}</span>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className={cn(
          'rounded-sm p-0.5 hover:bg-white/10 transition-colors',
          config.text,
        )}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
