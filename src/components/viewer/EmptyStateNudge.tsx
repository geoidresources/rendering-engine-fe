'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateNudgeProps {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export const EmptyStateNudge: React.FC<EmptyStateNudgeProps> = ({
  icon,
  title,
  hint,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-6 py-10 text-center',
        className,
      )}
    >
      {icon && (
        <div className="text-text-muted/60 mb-1">{icon}</div>
      )}
      <p className="text-[12px] text-text-primary font-medium leading-snug">
        {title}
      </p>
      {hint && (
        <p className="text-[11px] text-text-muted leading-snug max-w-[28ch]">
          {hint}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 inline-flex items-center gap-1 rounded-sm border border-border-subtle bg-bg-elevated px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-primary hover:bg-bg-surface transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
