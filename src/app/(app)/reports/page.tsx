"use client";

import { useState, useMemo } from "react";
import PageShell from "@/components/ui/PageShell";
import { 
  Search, 
  Wifi, 
  Rss, 
  Headphones, 
  Plus, 
  MoreHorizontal, 
  Info,
  Calendar,
  Layers,
  ChevronDown,
  Download,
  ExternalLink,
  Table as TableIcon,
  Loader2
} from "lucide-react";
import { 
  Input, 
  Button, 
  Switch, 
  Tab, 
  Tabs 
} from "@heroui/react";
import { toast } from "sonner";
import { useReports, type Report } from "./reports-data";

export default function ReportsPage() {
  const [activeTab, setActiveTab ] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { reports, isLoading, totalCount, filteredCount } = useReports(searchTerm, activeTab);

  const handleGenerateReport = () => {
    toast.success("Intelligence generation initiated", {
      description: "Allocating compute resources for volumetric analysis...",
    });
  };

  const CustomHeader = (
    <div className="flex items-center justify-between gap-4 w-full py-2">
      <div className="flex items-center gap-6">
        <h1 className="text-zinc-900 dark:text-white text-xl font-bold tracking-widest uppercase">REPORTS</h1>
        
        {/* Search Bar */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input 
            type="text" 
            placeholder="SEARCH ARCHIVES..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-[10px] font-bold tracking-widest text-zinc-500 focus:outline-none focus:border-yellow-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Connection Icons */}
        <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
          <Rss size={18} className="cursor-pointer hover:text-white transition-colors" />
          <Headphones size={18} className="cursor-pointer hover:text-white transition-colors" />
          <Wifi size={18} className="cursor-pointer hover:text-white transition-colors" />
        </div>

        <Button 
          className="bg-[#F4B400] text-black text-[10px] font-bold tracking-widest rounded-md px-6 h-9"
          onClick={handleGenerateReport}
        >
          <div className="flex items-center gap-2">
            <Plus size={14} strokeWidth={3} />
            <span>NEW GENERATION</span>
          </div>
        </Button>
      </div>
    </div>
  );

  return (
    <PageShell customHeader={CustomHeader}>
      <div className="flex gap-6 h-full">
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Tabs */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            {["ALL REPORTS", "TEMPLATES", "SCHEDULED"].map((tab) => {
              const tabId = tab.toLowerCase().split(" ")[0]; // "all", "templates", "scheduled"
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tabId)}
                  className={`px-4 py-3 text-[10px] font-bold tracking-widest transition-all relative
                    ${activeTab === tabId 
                      ? "text-[#F1C40F]" 
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                    }
                  `}
                >
                  {tab}
                  {activeTab === tabId && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F4B400]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto min-h-[400px] flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-500">
                <Loader2 size={32} className="animate-spin text-[#F4B400]" />
                <span className="text-[10px] font-bold tracking-[0.3em] uppercase">ACCESSING SECURE ARCHIVES...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-500">
                <Info size={32} strokeWidth={1.5} />
                <span className="text-[10px] font-bold tracking-widest uppercase">NO MATCHING ARCHIVES FOUND</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-xs text-[#F1C40F]" 
                  onClick={() => {setSearchTerm(""); setActiveTab("all");}}
                >
                  CLEAR ALL FILTERS
                </Button>
              </div>
            ) : (
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                    <th className="pb-4 px-4 font-bold">REPORT NAME</th>
                    <th className="pb-4 px-4">PROJECT</th>
                    <th className="pb-4 px-4">TYPE</th>
                    <th className="pb-4 px-4">GENERATED BY</th>
                    <th className="pb-4 px-4">DATE</th>
                    <th className="pb-4 px-4">STATUS</th>
                    <th className="pb-4 px-4">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] font-bold tracking-wider">
                  {reports.map((report) => (
                    <tr key={report.id} className="group">
                      <td className="py-4 px-4 bg-zinc-50/50 dark:bg-zinc-900/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/50 transition-colors rounded-l-lg border border-r-0 border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <TableIcon size={14} className="text-cyan-500" />
                          <span className="text-zinc-900 dark:text-zinc-300">{report.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 bg-zinc-50/50 dark:bg-zinc-900/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/50 transition-colors border-y border-zinc-200 dark:border-zinc-800 text-zinc-500">
                        {report.project}
                      </td>
                      <td className="py-4 px-4 bg-zinc-50/50 dark:bg-zinc-900/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/50 transition-colors border-y border-zinc-200 dark:border-zinc-800 text-zinc-500">
                        {report.type}
                      </td>
                      <td className="py-4 px-4 bg-zinc-50/50 dark:bg-zinc-900/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/50 transition-colors border-y border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-500 uppercase">{report.generatedBy[0]}</div>
                          <span className="text-zinc-900 dark:text-zinc-400">{report.generatedBy}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 bg-zinc-50/50 dark:bg-zinc-900/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/50 transition-colors border-y border-zinc-200 dark:border-zinc-800 text-zinc-500">
                        {report.date}
                      </td>
                      <td className="py-4 px-4 bg-zinc-50/50 dark:bg-zinc-900/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/50 transition-colors border-y border-zinc-200 dark:border-zinc-800">
                        <StatusPill status={report.status} />
                      </td>
                      <td className="py-4 px-4 bg-zinc-50/50 dark:bg-zinc-900/30 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-900/50 transition-colors rounded-r-lg border border-l-0 border-zinc-200 dark:border-zinc-800">
                        <Button isIconOnly size="sm" variant="ghost" className="text-zinc-500 hover:text-[#F1C40F]"><MoreHorizontal size={16} /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination */}
          <div className="mt-auto flex items-center justify-between text-[10px] font-bold tracking-widest text-zinc-500 py-4 uppercase">
            <span>SHOWING {filteredCount} OF {totalCount} ARCHIVES</span>
            <div className="flex items-center gap-2">
              <Button isIconOnly size="sm" variant="ghost" className="text-zinc-500 border border-zinc-200 dark:border-zinc-800"><Plus size={12} className="rotate-45" /></Button>
              <button className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 border border-yellow-500/50 text-[#F1C40F] rounded-md">1</button>
              <button className="w-8 h-8 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors rounded-md text-zinc-400">2</button>
              <button className="w-8 h-8 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors rounded-md text-zinc-400">3</button>
              <Button isIconOnly size="sm" variant="ghost" className="text-zinc-500 border border-zinc-200 dark:border-zinc-800"><Plus size={12} className="-rotate-45" /></Button>
            </div>
          </div>
        </div>

        {/* Right Configuration Sidebar */}
        <div className="w-[340px] flex flex-col gap-6">
          <div className="bg-zinc-50 dark:bg-[#0d1117] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col gap-6 shadow-sm">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-900 dark:text-zinc-200 uppercase">NEW REPORT CONFIGURATION</h3>
              
              <div className="space-y-2">
                <label className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">SELECT INTELLIGENCE TEMPLATE</label>
                <div className="relative group">
                  <div className="w-full bg-zinc-100 dark:bg-[#161b22] border border-yellow-500/30 rounded-lg p-3 cursor-pointer hover:border-yellow-500/60 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#F1C40F] tracking-widest">MONTHLY STOCKPILE</span>
                      <ChevronDown size={14} className="text-[#F1C40F]" />
                    </div>
                    <p className="text-[8px] text-zinc-500 mt-1 leading-relaxed">Full volumetric analysis of all active stockpiles with error variance mapping.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 opacity-50">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-zinc-400 cursor-not-allowed">
                  <span>CUT / FILL BALANCE</span>
                  <ChevronDown size={14} />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-zinc-400 cursor-not-allowed">
                  <span>FLIGHT TELEMETRY</span>
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <h3 className="text-[9px] font-bold tracking-[0.2em] text-zinc-500 uppercase">INTELLIGENCE LAYERS</h3>
              <div className="space-y-4">
                <ToggleLayer label="3D MESH EXPORT" active={true} />
                <ToggleLayer label="ORTHO-MOSAIC TIFF" active={true} />
                <ToggleLayer label="RAW POINT CLOUD" active={false} />
              </div>
            </div>

            <Button 
              className="w-full bg-[#F4B400] text-black text-[10px] font-bold tracking-widest rounded-md h-12 mt-2 hover:bg-[#F2A100] transition-colors"
              onClick={handleGenerateReport}
            >
              GENERATE INTELLIGENCE
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="flex gap-4">
            <StatBox label="STORAGE" value="84.2%" sub="4.2 TB / 5.0 TB" color="text-cyan-400" />
            <StatBox label="QUOTA" value="12/15" sub="REPORTS REMAINING" color="text-yellow-500" />
          </div>

          {/* Preview Box */}
          <div className="bg-zinc-50 dark:bg-[#0d1117] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex-1 flex flex-col gap-4 relative overflow-hidden group border-dashed">
             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888941259-79d745bc47eb?q=80&w=340')] bg-cover opacity-20 group-hover:scale-110 transition-transform duration-1000 brightness-50" />
             <div className="relative z-10 flex flex-col h-full">
                <h3 className="text-[9px] font-bold tracking-[0.2em] text-zinc-500 uppercase">ARCHIVE PREVIEW</h3>
                <div className="mt-auto">
                   <p className="text-[10px] font-bold text-zinc-200 tracking-widest drop-shadow-md">
                     {reports[0]?.name || "NO ACTIVE SELECTION"}
                   </p>
                </div>
             </div>
             <div className="absolute top-2 right-2 z-10">
                <div className="bg-cyan-500 text-black text-[8px] font-black px-2 py-0.5 rounded tracking-tighter">LIVE DATA</div>
             </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}

function StatusPill({ status }: { status: Report["status"] }) {
  const styles = {
    VALIDATED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    PROCESSING: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
    FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
  }[status] || "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";

  return (
    <div className={`px-3 py-1 rounded text-[8px] font-black border tracking-widest inline-flex items-center justify-center ${styles}`}>
      {status}
    </div>
  );
}

function ToggleLayer({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">{label}</span>
      <Switch 
        defaultSelected={active} 
        size="sm" 
        className="data-[selected=true]:bg-[#F4B400]"
      />
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="flex-1 bg-zinc-50 dark:bg-[#0d1117] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-2 shadow-sm">
      <span className="text-[8px] font-bold tracking-widest text-zinc-500 uppercase">{label}</span>
      <div className={`text-xl font-bold tracking-widest ${color}`}>{value}</div>
      <span className="text-[8px] font-medium tracking-tight text-zinc-500 uppercase">{sub}</span>
    </div>
  );
}
