import Link from "next/link";
import { Map, Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[560px] rounded-sm border border-border-subtle bg-bg-surface/95 p-8 sm:p-10 backdrop-blur-xl">
        <div className="flex flex-col items-center text-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-sm border border-primary/20 bg-primary/10">
            <Map size={28} className="text-primary" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated px-3 py-1 text-[10px] font-mono uppercase tracking-[0.3em] text-text-muted">
            <Wrench size={12} />
            Scheduled Maintenance
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold uppercase tracking-wider text-text-primary">
              GEOID System is temporarily offline
            </h1>
            <p className="mx-auto max-w-[42ch] text-sm leading-6 text-text-secondary">
              We are performing maintenance right now. Access is temporarily restricted while
              updates are being completed.
            </p>
          </div>

          <div className="w-full rounded-sm border border-border-subtle bg-bg-elevated px-5 py-4 text-left">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-muted">
              Status
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Please check back shortly or contact the platform administrator if you need an
              update on availability.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-sm border border-border-subtle bg-bg-elevated px-6 text-xs font-semibold uppercase tracking-[0.25em] text-text-primary transition-colors hover:bg-bg-base"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
