'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// `render` prop is the base-ui slot pattern used by this project's Button.

export type ManifestOverlayVariant = 'loading' | 'error' | 'no_data';

interface ManifestUnavailableOverlayProps {
  variant: ManifestOverlayVariant;
  /** Human-readable error detail shown in the `error` variant. */
  errorMessage?: string;
  /** Called when the user clicks "Retry" in the `error` variant. */
  onRetry?: () => void;
  className?: string;
}

export function ManifestUnavailableOverlay({
  variant,
  errorMessage,
  onRetry,
  className,
}: ManifestUnavailableOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-30 flex items-center justify-center',
        'bg-bg-base/80 supports-[backdrop-filter]:bg-bg-base/60 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 rounded-sm border border-border-subtle bg-bg-surface/90 px-8 py-8 text-center shadow-xl max-w-sm w-full mx-4">
        {variant === 'loading' && (
          <>
            <Loader2 className="size-8 text-accent animate-spin" />
            <div>
              <p className="text-text-primary text-sm font-semibold">Loading survey data</p>
              <p className="text-muted-foreground text-xs mt-1 font-mono">
                Fetching manifest and asset URLs…
              </p>
            </div>
          </>
        )}

        {variant === 'error' && (
          <>
            <AlertTriangle className="size-8 text-amber-400" />
            <div>
              <p className="text-text-primary text-sm font-semibold">Survey data unavailable</p>
              {errorMessage && (
                <p className="text-muted-foreground text-xs mt-1 font-mono">{errorMessage}</p>
              )}
            </div>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
                Retry
              </Button>
            )}
          </>
        )}

        {variant === 'no_data' && (
          <>
            <Info className="size-8 text-blue-400" />
            <div>
              <p className="text-text-primary text-sm font-semibold">
                No processed data for this survey yet
              </p>
              <p className="text-muted-foreground text-xs mt-1 font-mono">
                Upload and process survey files to populate this view.
              </p>
            </div>
            <Button size="sm" variant="outline" className="mt-1" render={<Link href="/surveys/upload" />}>
              Go to Uploads
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
