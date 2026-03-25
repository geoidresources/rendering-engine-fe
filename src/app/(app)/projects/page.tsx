import PageShell from "@/components/ui/PageShell";

export default function ProjectsPage() {
  return (
    <PageShell
      title="Projects"
      description="All accessible mine site projects. Filter by client, commodity, or search by name."
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          Project list — cards with site name, client, commodity, latest survey date, and status badge will render here.
        </p>
      </div>
    </PageShell>
  );
}
