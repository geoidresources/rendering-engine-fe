"use client";

import PageShell from "@/components/ui/PageShell";

const TABS = ["Templates", "Generated Reports"];

export default function ReportsPage() {
  return (
    <PageShell
      title="Reports"
      description="PDF and Excel report generation — branded templates and versioned outputs."
    >
      <div className="flex gap-1 border-b border-zinc-800 mb-6 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors
              ${i === 0
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-zinc-500 hover:text-zinc-300"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">Report templates and generated report list will appear here.</p>
      </div>
    </PageShell>
  );
}
