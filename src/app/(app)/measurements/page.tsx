"use client";

import { useState } from "react";
import PageShell from "@/components/ui/PageShell";
import { 
  Search, 
  Wifi, 
  Radio, 
  Download, 
  Filter, 
  X, 
  MoreHorizontal,
  ChevronRight,
  TrendingUp,
  Box,
  Target,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import "./measurements.css";

const MOCK_MEASUREMENTS = [
  { id: "#GEC-8842", project: "OBSIDIAN RIDGE", type: "STOCKPILE A-12", volume: "14,204.82", method: "LIDAR SCAN", analyst: "Dr. Aris Thorne", date: "2024-05-12", status: "VERIFIED" },
  { id: "#GEC-8843", project: "IRON DEEP V", type: "TAILINGS POND", volume: "8,912.40", method: "PHOTOGRAMMETRY", analyst: "Sarah Jenkins", date: "2024-05-11", status: "VERIFIED" },
  { id: "#GEC-8844", project: "OBSIDIAN RIDGE", type: "SHAFT #09", volume: "1,024.18", method: "LIDAR SCAN", analyst: "Dr. Aris Thorne", date: "2024-05-11", status: "PROCESSING" },
  { id: "#GEC-8845", project: "BLUE QUARTZ SITE", type: "EXCAVATION 4B", volume: "22,450.00", method: "DRONE MAP", analyst: "Marcus Vane", date: "2024-05-10", status: "VERIFIED" },
  { id: "#GEC-8846", project: "OBSIDIAN RIDGE", type: "STOCKPILE B-04", volume: "4,112.55", method: "LIDAR SCAN", analyst: "Dr. Aris Thorne", date: "2024-05-10", status: "VERIFIED" },
  { id: "#GEC-8847", project: "IRON DEEP V", type: "SHAFT #02", volume: "15,670.30", method: "DRONE MAP", analyst: "Sarah Jenkins", date: "2024-05-09", status: "FLAGGED" },
];

const STATS = [
  { label: "TOTAL INVENTORY", value: "65,334", subValue: ".25", unit: "METRIC TONS / M³ TOTAL", icon: TrendingUp },
  { label: "SCAN ACCURACY", value: "99.8", subValue: "%", unit: "ACROSS ALL LIDAR NODES", icon: Target },
  { label: "ACTIVE PROJECTS", value: "12", subValue: "", unit: "VERIFIED SITES", icon: Box },
  { label: "ANOMALIES", value: "02", subValue: "", unit: "REQUIRING HUMAN REVIEW", icon: AlertTriangle },
];

export default function MeasurementsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMeasurements = MOCK_MEASUREMENTS.filter(m => 
    m.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMeasurement = MOCK_MEASUREMENTS.find(m => m.id === selectedId);

  const handleExport = () => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
      loading: "Generating CSV export...",
      success: "Inventory data exported successfully",
      error: "Export failed",
    });
  };

  const handleNewMeasurement = () => {
    toast.info("Initializing new volumetric measurement sequence...");
  };

  return (
    <PageShell hideDefaultHeader>
      <div className="measurements-container">
        
        {/* Header Bar */}
        <div className="subheader-bar">
          <div className="flex items-center gap-4">
            <span className="badge-yellow">MEASUREMENTS</span>
            <span className="text-zinc-700">|</span>
            <div className="search-telemetry-container">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="SEARCH TELEMETRY..."
                className="search-telemetry-input pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-zinc-500">
              <Wifi size={16} />
              <Radio size={16} />
            </div>
            <button className="btn-browse" onClick={handleNewMeasurement}>
              NEW MEASUREMENT
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* Inventory Controls */}
          <div className="inventory-header">
            <div>
              <h1 className="main-title">VOLUMETRIC <span>INVENTORY</span></h1>
              <p className="protocol-text">LIVE SUBTERRANEAN SCAN DATA : 14 ACTIVE NODES</p>
            </div>
            <div className="header-actions">
              <button className="btn-outline" onClick={handleExport}>
                <Download size={14} className="inline mr-2" /> EXPORT CSV
              </button>
              <button className="btn-outline" onClick={() => toast.info("Filters panel opened")}>
                <Filter size={14} className="inline mr-2" /> FILTERS
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>PROJECT</th>
                  <th>TYPE</th>
                  <th>VOLUME (M³)</th>
                  <th>METHOD</th>
                  <th>ANALYST</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeasurements.map((m) => (
                  <tr 
                    key={m.id} 
                    onClick={() => setSelectedId(m.id)}
                    className={selectedId === m.id ? "selected" : ""}
                  >
                    <td className="id-cell">{m.id}</td>
                    <td className="font-black">{m.project}</td>
                    <td className="text-zinc-400">{m.type}</td>
                    <td className="font-black">{m.volume}</td>
                    <td>
                      <span className="method-tag">{m.method}</span>
                    </td>
                    <td className="text-zinc-400">{m.analyst}</td>
                    <td className="text-zinc-500">{m.date}</td>
                    <td>
                      <div className="status-pill">
                        <div className={`dot ${m.status.toLowerCase()}`} />
                        {m.status}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            {STATS.map((s, idx) => (
              <div key={idx} className="stat-card">
                <span className="stat-label">{s.label}</span>
                <div className="stat-value">
                  {s.value}<span>{s.subValue}</span>
                </div>
                <span className="stat-unit">{s.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inspector Sidebar */}
        <div className={`inspector-panel ${selectedId ? "open" : ""}`}>
          {selectedId && selectedMeasurement && (
            <>
              <div className="inspector-header">
                <h2 className="inspector-title">POINT CLOUD <span>INSPECTOR</span></h2>
                <button className="btn-close" onClick={() => setSelectedId(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="inspector-section">
                <div className="section-label">
                  <span className="label-text">3D MESH: {selectedMeasurement.type}</span>
                  <button className="btn-live">LIVE SCAN</button>
                </div>
                <div className="mesh-preview-container">
                  <Image 
                    src="/assets/measurements/mesh_preview.png" 
                    alt="3D Mesh Preview" 
                    width={400} 
                    height={400} 
                    className="mesh-image"
                  />
                  <div className="mesh-overlay">
                    X: 428.11<br />
                    Y: 332.54
                  </div>
                </div>
              </div>

              <div className="inspector-section">
                <div className="section-label">
                  <span className="label-text">VOLUME COMPARISON (M³)</span>
                </div>
                <div className="comparison-container">
                  <div className="comparison-item">
                    <div className="comp-header">
                      <span className="comp-label">CURRENT SCAN (MAY 12)</span>
                      <span className="comp-value">{selectedMeasurement.volume}</span>
                    </div>
                    <div className="comp-bar-bg">
                      <div className="comp-bar-fill current" />
                    </div>
                  </div>
                  <div className="comparison-item">
                    <div className="comp-header">
                      <span className="comp-label">BASELINE (APR 22)</span>
                      <span className="comp-value">12,110.15</span>
                    </div>
                    <div className="comp-bar-bg">
                      <div className="comp-bar-fill baseline" />
                    </div>
                  </div>
                  <div className="comparison-item">
                    <div className="comp-header">
                      <span className="comp-label">PROJECTED TARGET</span>
                      <span className="comp-value">15,000.00</span>
                    </div>
                    <div className="comp-bar-bg">
                      <div className="comp-bar-fill target" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="inspector-section">
                <div className="section-label">
                  <span className="label-text">SENSOR TELEMETRY</span>
                </div>
                <div className="telemetry-grid">
                  <div className="tel-item">
                    <span className="tel-label">SENSOR ID</span>
                    <span className="tel-value">LR-X9-DELTA</span>
                  </div>
                  <div className="tel-item">
                    <span className="tel-label">POINT DENSITY</span>
                    <span className="tel-value">8.4K / m²</span>
                  </div>
                  <div className="tel-item">
                    <span className="tel-label">REFLECTANCE</span>
                    <span className="tel-value">0.84 µ</span>
                  </div>
                  <div className="tel-item">
                    <span className="tel-label">DRIFT RATIO</span>
                    <span className="tel-value">0.0001%</span>
                  </div>
                </div>
              </div>

              <div className="inspector-footer">
                <button className="btn-primary-ghost" onClick={() => toast.info("Starting mesh re-processing...")}>
                  RE-PROCESS POINT CLOUD
                </button>
                <button className="btn-link" onClick={() => toast.success("Mesh download started")}>
                  DOWNLOAD MESH (.OBJ)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
