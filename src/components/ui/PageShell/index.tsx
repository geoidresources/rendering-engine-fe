"use client";

import Link from "next/link";
import AppButton from "@/components/ui/AppButton";

interface PageShellProps {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}

/**
 * Global page shell — consistent header (title + optional CTA) above a content area.
 */
export default function PageShell({ title, description, action, children }: PageShellProps) {
  return (
    <div className="p-6 flex flex-col gap-6 min-h-full">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-zinc-900 dark:text-white text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-zinc-600 dark:text-zinc-500 text-sm mt-0.5 max-w-2xl">{description}</p>
          )}
        </div>
        {action && (
          <Link href={action.href}>
            <AppButton
              size="sm"
              variant="primary"
              className="text-xs font-semibold px-4"
            >
              {action.label}
            </AppButton>
          </Link>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-200 dark:border-zinc-800" />

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
