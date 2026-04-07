"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  LayoutGrid, 
  FolderOpen, 
  CloudUpload, 
  Ruler, 
  ArrowLeftRight, 
  Map, 
  Layers, 
  BarChart3, 
  Key,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Activity,
  LifeBuoy
} from "lucide-react";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { AUTH_TOKEN_KEY } from "@/lib/constants";

const NAV_ITEMS = [
  { id: "overview", label: "OVERVIEW", href: "/home", icon: <LayoutGrid size={18} /> },
  { id: "projects", label: "PROJECTS", href: "/projects", icon: <FolderOpen size={18} /> },
  { id: "upload", label: "UPLOAD", href: "/surveys/upload", icon: <CloudUpload size={18} /> },
  { id: "measurements", label: "MEASUREMENTS", href: "/measurements", icon: <Ruler size={18} /> },
  { id: "reconciliation", label: "RECONCILIATION", href: "/reconciliation", icon: <ArrowLeftRight size={18} /> },
  { id: "map-2d", label: "MAP 2D", href: "/mapview", icon: <Map size={18} /> },
  { id: "map-3d", label: "MAP 3D", href: "/viewer-3d", icon: <Layers size={18} /> },
  { id: "reporting", label: "REPORTING", href: "/reports", icon: <BarChart3 size={18} /> },
  { id: "access", label: "ACCESS", href: "/users", icon: <Key size={18} /> },
  { id: "settings", label: "SETTINGS", href: "/settings", icon: <Settings size={18} /> },
];

const SECONDARY_NAV = [
  { id: "health", label: "SYSTEM HEALTH", href: "/health", icon: <Activity size={16} /> },
  { id: "support", label: "SUPPORT", href: "/support", icon: <LifeBuoy size={16} /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    router.push("/login");
  };

  return (
    <aside
      className={`
        flex flex-col h-screen transition-all duration-300 ease-in-out border-r
        ${collapsed ? "w-[64px]" : "w-[260px]"}
        bg-[#0A0D12] border-zinc-800
        shrink-0 z-50
      `}
    >
      {/* Logo Header */}
      <div className="flex flex-col px-6 py-8 min-h-[120px] gap-1 relative group">
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-white text-xl font-black tracking-[0.2em] uppercase">
                GEOID SYSTEM
              </span>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-white"
                onPress={() => setCollapsed(true)}
              >
                <ChevronLeft size={16} />
              </Button>
            </div>
            <span className="text-[9px] font-bold tracking-[0.3em] text-[#F4B400] uppercase mt-1">
              SUBTERRANEAN INTEL
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[#F4B400] text-xl font-black tracking-[0.1em]">G</span>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="text-zinc-500 hover:text-white"
              onPress={() => setCollapsed(false)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 overflow-y-auto px-0 py-2 flex flex-col gap-0.5 custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex items-center gap-4 py-3.5 px-6 transition-all relative group
                ${isActive 
                  ? "text-white bg-zinc-900/50" 
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/30"
                }
              `}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#F4B400] rounded-r-full shadow-[0_0_10px_rgba(244,180,0,0.5)]" />
              )}
              
              <span className={`shrink-0 transition-colors ${isActive ? "text-[#F4B400]" : "group-hover:text-zinc-300"}`}>
                {item.icon}
              </span>
              
              {!collapsed && (
                <span className="text-[11px] font-bold tracking-[0.15em] truncate uppercase">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* New Survey Button Area */}
      {!collapsed && (
        <div className="px-6 py-6 border-t border-zinc-800/50">
          <Link href="/surveys/new">
            <button className="w-full bg-[#F4B400] hover:bg-[#FFC107] text-black text-[11px] font-black tracking-[0.2em] py-3.5 rounded transition-all shadow-[0_4px_20px_rgba(244,180,0,0.15)] active:scale-[0.98] uppercase">
              NEW SURVEY
            </button>
          </Link>
        </div>
      )}

      {/* Footer Nav & User Profile */}
      <div className="mt-auto flex flex-col border-t border-zinc-800/80">
        <div className="flex flex-col py-4">
          {SECONDARY_NAV.map((item) => (
             <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 py-2.5 px-6 text-zinc-500 hover:text-zinc-200 transition-colors group"
             >
                <span className="shrink-0 group-hover:text-[#F4B400]">{item.icon}</span>
                {!collapsed && (
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase">{item.label}</span>
                )}
             </Link>
          ))}
        </div>

        <div className="p-6 bg-[#0E1218] flex items-center justify-between border-t border-zinc-800/50">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center text-[#F4B400] font-black text-sm border border-zinc-700 shrink-0">
               OP
             </div>
             {!collapsed && (
               <div className="flex flex-col min-w-0">
                 <span className="text-[11px] font-bold text-white tracking-widest truncate uppercase">PETER_ADMIN</span>
                 <span className="text-[9px] font-bold text-zinc-500 tracking-wider truncate uppercase">LEVEL 4 CLEARANCE</span>
               </div>
             )}
          </div>
          {!collapsed && (
            <button 
              onClick={handleSignOut}
              className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
