"use client";

import { useState, useRef, useCallback } from "react";
import PageShell from "@/components/ui/PageShell";
import {
   CloudUpload,
   Search,
   Wifi,
   Radio,
   ChevronDown,
   FileText,
   X,
   RotateCcw,
   Play,
   Database,
   Activity
} from "lucide-react";
import {
   Button,
} from "@heroui/react";
import { toast } from "sonner";
import "./upload.css";

const ACTIVE_UPLOADS = [
   { id: 1, name: "SHAFT_09_VOIDS_V2.LAS", size: "1.2 GB / 2.4 GB", speed: "4.2 MB/S", progress: 50, color: "warning" },
   { id: 2, name: "TERRAIN_SCAN_NORTH.LAZ", size: "842 MB / 950 MB", speed: "8.1 MB/S", progress: 88, color: "warning" },
];

const LOGS = [
   { id: 1, type: "COMPLETE", target: "SHAFT_8_FINAL.LAS", time: "14:22:15 UTC" },
   { id: 2, type: "ARCHIVE", target: "SECTOR_F_2023_BACKUP", time: "12:05:54 UTC" },
   { id: 3, type: "NEW PROJECT CREATED", target: "DEEP_SCAN_B", time: "09:12:44 UTC" },
];

export default function SurveyUploadPage() {
   const [files, setFiles] = useState<File[]>([]);
   const [isDragging, setIsDragging] = useState(false);
   const [ingestionNotes, setIngestionNotes] = useState("");
   const fileInputRef = useRef<HTMLInputElement>(null);

   const handleFiles = useCallback((incomingFiles: FileList | File[]) => {
      const fileArray = Array.from(incomingFiles);
      setFiles(prev => [...prev, ...fileArray]);
      toast.success(`${fileArray.length} file(s) added to queue`);
   }, []);

   const handleBrowseClick = () => {
      fileInputRef.current?.click();
   };

   const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
         handleFiles(e.target.files);
      }
   };

   const onDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
   };

   const onDragLeave = () => {
      setIsDragging(false);
   };

   const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
         handleFiles(e.dataTransfer.files);
      }
   };

   const handleReset = () => {
      setFiles([]);
      setIngestionNotes("");
      toast.info("Form and file queue cleared");
   };

   const handleInitializeIngest = () => {
      if (files.length === 0) {
         toast.error("Please add at least one file to ingest");
         return;
      }
      toast.promise(new Promise(resolve => setTimeout(resolve, 2000)), {
         loading: "Initializing ingestion secure transfer protocol...",
         success: "Protocol established. Data ingestion starting.",
         error: "Protocol handshake failed",
      });
   };

   const removeFile = (index: number) => {
      setFiles(prev => prev.filter((_, i) => i !== index));
      toast.info("File removed from queue");
   };

   return (
      <PageShell hideDefaultHeader>
         <div className="ingest-portal-container">

            {/* Sub Header */}
            <div className="subheader-bar">
               <div className="flex items-center gap-4">
                  <span className="badge-yellow">UPLOAD & INGEST</span>
                  <span className="text-zinc-700">|</span>
                  <span className="badge-zinc">NODE: CENTRAL-04</span>
               </div>
               <div className="flex items-center gap-6">
                  <div className="search-telemetry-container">
                     <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                     <input
                        type="text"
                        placeholder="SEARCH TELEMETRY..."
                        className="search-telemetry-input pl-9"
                     />
                  </div>
                  <div className="flex items-center gap-4 text-zinc-500">
                     <Wifi size={16} />
                     <Radio size={16} />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

               {/* Left Column: Form and Main Drop Zone */}
               <div className="lg:col-span-2 flex flex-col gap-8">
                  <div className="space-y-1">
                     <h1 className="main-title">DATA INGESTION PORTAL</h1>
                     <p className="protocol-text">PROTOCOL: SECURE_TRANSFER_V2.LAS</p>
                  </div>

                  {/* Main Drop Area */}
                  <div className="drop-zone-container">
                     <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onFileSelect}
                        multiple
                        className="hidden"
                     />
                     <div
                        className={`drop-zone-box ${isDragging ? "dragging" : ""}`}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={handleBrowseClick}
                     >
                        <div className="drop-zone-icon-box">
                           <CloudUpload size={32} />
                        </div>
                        <div className="text-center space-y-2">
                           <h3 className="drop-zone-title">DRAG Lidar SENSOR DATA</h3>
                           <p className="drop-zone-subtitle">SUPPORTED FORMATS: .LAS, .LAZ, .XYZ, .E57 (MAX 4GB PER FILE)</p>
                        </div>
                        <button
                           className="btn-browse"
                           onClick={(e) => {
                              e.stopPropagation();
                              handleBrowseClick();
                           }}
                        >
                           BROWSE LOCAL STORAGE
                        </button>
                     </div>
                  </div>

                  {/* Selected Files List (New) */}
                  {files.length > 0 && (
                     <div className="bg-zinc-900/20 border border-zinc-800 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center justify-between">
                           <span className="badge-zinc">QUEUED FILES ({files.length})</span>
                           <button onClick={() => setFiles([])} className="text-[8px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           {files.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-lg group">
                                 <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="p-2 bg-blue-500/10 rounded text-blue-400 shrink-0">
                                       <Database size={14} />
                                    </div>
                                    <div className="flex flex-col truncate">
                                       <span className="text-[10px] font-bold text-white truncate">{file.name}</span>
                                       <span className="text-[8px] font-bold text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                    </div>
                                 </div>
                                 <button
                                    onClick={() => removeFile(idx)}
                                    className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
                                 >
                                    <X size={14} />
                                 </button>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  {/* Metadata Form */}
                  <div className="metadata-card">
                     <div className="flex items-center gap-3">
                        <FileText size={18} className="text-[#F4B400]" />
                        <h3 className="text-[11px] font-black text-zinc-300 tracking-[0.2em] uppercase">SURVEY METADATA SCHEMA</h3>
                        <span className="ml-auto text-[8px] font-black text-blue-400 tracking-widest uppercase">AUTO-FILLING ENABLED</span>
                     </div>

                     <div className="grid grid-cols-2 gap-8">
                        <div className="form-group space-y-2">
                           <label className="form-label">PROJECT ASSIGNMENT</label>
                           <div className="relative">
                              <select className="form-select">
                                 <option>SECTOR_ALPHA_MINING_GRID_04</option>
                                 <option>SECTOR_BETA_DEEP_MINING</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="form-label">SURVEY DATE</label>
                           <div className="form-input-static">
                              11/24/2023
                           </div>
                        </div>
                        <div className="form-group space-y-2">
                           <label className="form-label">COORDINATE REFERENCE SYSTEM (CRS)</label>
                           <div className="relative">
                              <select className="form-select">
                                 <option>EPSG-28356 - GDA94 / MGA ZONE 56</option>
                                 <option>EPSG-4326 - WGS 84</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                           </div>
                        </div>
                        <div className="form-group space-y-2">
                           <label className="form-label">SENSOR HARDWARE TYPE</label>
                           <div className="relative">
                              <select className="form-select">
                                 <option>LEICA_BLK2FLY_MOBILE_SCANNER</option>
                                 <option>DJI_ZENMUSE_L1</option>
                                 <option>RIEGL_VUX-1UAV</option>
                              </select>
                              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                           </div>
                        </div>
                     </div>

                     <div className="form-group space-y-2">
                        <label className="form-label">INGESTION NOTES</label>
                        <textarea
                           placeholder="DESCRIBE SURVEY CONDITIONS OR DATA ANOMALIES..."
                           className="form-textarea"
                           value={ingestionNotes}
                           onChange={(e) => setIngestionNotes(e.target.value)}
                        />
                     </div>

                     <div className="flex justify-end gap-4 pt-4">
                        <button
                           className="btn-reset"
                           onClick={handleReset}
                        >
                           <RotateCcw size={14} /> RESET FORM
                        </button>
                        <button
                           className="btn-initialize"
                           onClick={handleInitializeIngest}
                        >
                           INITIALIZE INGEST
                        </button>
                     </div>
                  </div>
               </div>

               {/* Right Column: Sidepanels */}
               <div className="flex flex-col gap-8">

                  {/* Active Uploads Area */}
                  <div className="side-panel-card">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <CloudUpload size={18} className="text-[#F4B400]" />
                           <h3 className="panel-title">ACTIVE UPLOADS</h3>
                        </div>
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                     </div>

                     <div className="space-y-8">
                        {ACTIVE_UPLOADS.map((up) => (
                           <div key={up.id} className="space-y-3">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <h4 className="upload-item-name">{up.name}</h4>
                                    <span className="upload-item-meta">{up.size} — {up.speed}</span>
                                 </div>
                                 <span className="text-[10px] font-black text-[#F4B400] tracking-widest uppercase">{up.progress}%</span>
                              </div>
                              <div className="progress-bar-bg">
                                 <div
                                    className="progress-bar-fill"
                                    style={{ width: `${up.progress}%` }}
                                 />
                              </div>
                              <div className="flex gap-4">
                                 <button className="panel-btn-action" onClick={() => toast.info(`Pausing ${up.name}...`)}>PAUSE</button>
                                 <button className="panel-btn-action" onClick={() => toast.error(`${up.name} canceled`)}>CANCEL</button>
                              </div>
                           </div>
                        ))}

                        <div className="processing-pill group">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-cyan-500/10 rounded flex items-center justify-center text-cyan-400">
                                 <Activity size={14} />
                              </div>
                              <span className="text-[9px] font-black text-white tracking-widest uppercase">MESH_OPTIMIZATION_V4</span>
                           </div>
                           <span className="text-[8px] font-black text-cyan-400 tracking-widest uppercase animate-pulse">PROCESSING</span>
                        </div>
                     </div>
                  </div>

                  {/* Storage & Latency Cards */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="stat-card">
                        <span className="stat-label">CLOUD STORAGE</span>
                        <div className="stat-value">74% <span className="text-[10px] text-zinc-600 ml-0.5 uppercase">USED</span></div>
                     </div>
                     <div className="stat-card">
                        <span className="stat-label">LATENCY</span>
                        <div className="stat-value text-cyan-400 uppercase">24 MS</div>
                     </div>
                  </div>

                  {/* Ingestion Log */}
                  <div className="side-panel-card flex-1">
                     <h3 className="panel-title mb-8">INGESTION LOG</h3>
                     <div className="space-y-6 flex-1">
                        {LOGS.map((log) => (
                           <div key={log.id} className="flex gap-4">
                              <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full mt-1.5 shrink-0" />
                              <div className="space-y-1">
                                 <h4 className="log-item-type">
                                    <span className={log.type === "COMPLETE" ? "text-emerald-500" : "text-zinc-500"}>{log.type}</span>: {log.target}
                                 </h4>
                                 <span className="upload-item-meta">{log.time}</span>
                              </div>
                           </div>
                        ))}
                     </div>
                     <button
                        className="btn-view-log"
                        onClick={() => toast.info("Opening system telemetry logs...")}
                     >
                        VIEW FULL SYSTEM LOG
                     </button>
                  </div>

               </div>
            </div>

         </div>
      </PageShell >
   );
}

