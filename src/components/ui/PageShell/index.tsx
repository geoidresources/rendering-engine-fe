"use client";

import Link from "next/link";
import AppButton from "@/components/ui/AppButton";

interface PageShellProps {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}

export default function PageShell({ title, description, action, children }: PageShellProps) {
  return (
    <div className="p-6 flex flex-col gap-6 min-h-full">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text-primary text-xl font-semibold tracking-tight uppercase">
            {title}
          </h1>
          {description && (
            <p className="text-text-secondary text-sm mt-0.5 max-w-2xl">{description}</p>
          )}
        </div>
        {action && (
          <Link href={action.href}>
            <AppButton size="sm" variant="primary">
              {action.label}
            </AppButton>
          </Link>
        )}
      </div>

      <div className="border-t border-border-subtle" />

      <div className="flex-1">{children}</div>
    </div>
  );
}
