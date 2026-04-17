"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useViewerStore } from "@/store/viewerStore";
import { ProjectPlacard } from "@/app/(app)/project/sidebar/ProjectPlacard";
import type { SiteLocationProp } from "./types";

/* ── Ref bundle ────────────────────────────────────────────────
   All SVG refs are created in GlobeScene and forwarded here so
   the Three.js RAF loop can update them imperatively. */
export interface GlobeOverlayRefs {
  svgGroupRef:  React.RefObject<SVGGElement | null>;
  svgLineRef:   React.RefObject<SVGLineElement | null>;
  dotGroupRef:  React.RefObject<SVGGElement | null>;
  gradientRef:  React.RefObject<SVGLinearGradientElement | null>;
  cardContainerRef: React.RefObject<HTMLDivElement | null>;
}

interface Props extends GlobeOverlayRefs {
  sites: SiteLocationProp[];
}

/**
 * GlobeOverlay
 * Renders the HUD layer: SVG leader-line + pulsing dot, the project
 * info card, branding text, crosshair, and the site coordinate list.
 * All elements use `pointer-events-none` except the project card.
 */
export function GlobeOverlay({
  svgGroupRef,
  svgLineRef,
  dotGroupRef,
  gradientRef,
  cardContainerRef,
  sites,
}: Props) {
  const focusedProject   = useViewerStore((s) => s.focusedProject);
  const setFocusedProject = useViewerStore((s) => s.setFocusedProject);

  return (
    <div className="absolute inset-0 pointer-events-none select-none">

      {/* ── SVG leader line + pulsing dot ───────────────────────────────
          Updated imperatively every RAF frame — no React re-renders. */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ overflow: "visible", zIndex: 25 }}
      >
        <defs>
          <linearGradient
            id="gs-leader-grad"
            ref={gradientRef}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor="rgba(245,210,89,0.85)" />
            <stop offset="60%"  stopColor="rgba(245,210,89,0.35)" />
            <stop offset="100%" stopColor="rgba(245,210,89,0.1)"  />
          </linearGradient>
        </defs>

        {/* Group — starts hidden, revealed by first valid frame update */}
        <g ref={svgGroupRef} opacity="0">
          {/* Leader line: dot → card bottom-left */}
          <line
            ref={svgLineRef}
            stroke="url(#gs-leader-grad)"
            strokeWidth="1"
            strokeDasharray="5 3"
            strokeLinecap="round"
          />

          {/* Pulsing marker dot */}
          <g ref={dotGroupRef}>
            {/* Outer slow pulse */}
            <circle r="14" fill="rgba(245,210,89,0.04)">
              <animate attributeName="r"       values="10;18;10"     dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.15;0;0.15"  dur="2.4s" repeatCount="indefinite" />
            </circle>
            {/* Middle ring */}
            <circle r="7" fill="rgba(245,210,89,0.08)" stroke="rgba(245,210,89,0.45)" strokeWidth="0.75" />
            {/* Core dot */}
            <circle r="3.5" fill="rgba(245,210,89,0.95)" filter="drop-shadow(0 0 4px rgba(245,210,89,0.8))" />
          </g>
        </g>
      </svg>

      {/* ── Project info card — top-right ─────────────────────────────── */}
      <AnimatePresence>
        {focusedProject && (
          <motion.div
            key="card-wrapper"
            className="absolute top-6 right-6 z-30 pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <ProjectPlacard
              ref={cardContainerRef}
              project={focusedProject}
              onClose={() => setFocusedProject(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top-left branding */}
      <div className="absolute top-6 left-8 flex items-baseline gap-2">
        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.35em] text-white/50">
          GEOID
        </span>
        <span className="text-[8px] font-mono uppercase tracking-[0.2em] text-sky-400/30">
          Spatial Intelligence
        </span>
      </div>

      {/* Top-right: thin decorative lines */}
      <div className="absolute top-6 right-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-white/10" />
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500/30" />
        </div>
      </div>

      {/* Subtle crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]">
        <svg width="60" height="60" viewBox="0 0 60 60">
          <line x1="30" y1="8"  x2="30" y2="22" stroke="white" strokeWidth="0.5" />
          <line x1="30" y1="38" x2="30" y2="52" stroke="white" strokeWidth="0.5" />
          <line x1="8"  y1="30" x2="22" y2="30" stroke="white" strokeWidth="0.5" />
          <line x1="38" y1="30" x2="52" y2="30" stroke="white" strokeWidth="0.5" />
          <circle cx="30" cy="30" r="12" stroke="white" strokeWidth="0.3" fill="none" />
        </svg>
      </div>

      {/* Bottom-right: site coordinate list */}
      {sites.length > 0 && (
        <div className="absolute bottom-8 right-8 text-right flex flex-col gap-3">
          {sites.map((s, i) => (
            <div key={i}>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400/50 mb-0.5">
                {s.name ?? "Site"}
              </p>
              <p className="text-[9px] font-mono text-white/20">
                {Math.abs(s.lat).toFixed(4)}&deg;{s.lat >= 0 ? "N" : "S"}{" "}
                {Math.abs(s.lng).toFixed(4)}&deg;{s.lng >= 0 ? "E" : "W"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Bottom-left: status dot */}
      <div className="absolute bottom-8 left-8">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-amber-500/40 animate-pulse" />
          <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-white/15">
            Live
          </span>
        </div>
      </div>

      {/* Gradient vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(2,2,8,0.5) 100%)",
        }}
      />
    </div>
  );
}
