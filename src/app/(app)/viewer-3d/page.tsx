import PageShell from "@/components/ui/PageShell";

export default function ViewerPage() {
  return (
    <PageShell
      title="3D Viewer"
      description="Point cloud and mesh rendering with orbit, fly, clipping, and measurement tools."
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <p className="text-zinc-500 text-sm">
          3D Cesium viewer with tools panel (elevation profile, section plane, clipping box, named views) will render here.
        </p>
      </div>
    </PageShell>
  );
}
