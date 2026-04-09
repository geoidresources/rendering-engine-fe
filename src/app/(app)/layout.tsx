import Sidebar from "@/components/ui/Sidebar";
import TelemetryHeader from "@/components/ui/TelemetryHeader";
import StatusBar from "@/components/ui/StatusBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TelemetryHeader />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
