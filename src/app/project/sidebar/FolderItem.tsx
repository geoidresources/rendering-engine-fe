"use client";

import { useState, useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FolderIcon } from "./FolderIcon";

interface Props {
  label: string;
  /** Secondary line (e.g. survey count, date). */
  meta?: string;
  /** Is this folder currently expanded (showing children)? */
  isExpanded: boolean;
  /** Size preset — `project` uses a full-size folder, `survey` is more compact for nested rows. */
  variant?: "project" | "survey";
  /** Fires on header click. Sidebar decides whether to also flyTo. */
  onClick: () => void;
  /** Optional right-hand adornment (e.g. count badge). */
  right?: React.ReactNode;
  /** Children rendered below the folder when expanded (typically the nested list). */
  children?: React.ReactNode;
}

/**
 * Reusable folder row with paper-peek + expand animation.
 *
 * Three states drive the FolderIcon:
 *   - rest: not hovered, not expanded
 *   - peek: hovered (paper nudges out slightly)
 *   - open: expanded (paper fully out + front flap tilts)
 */
export function FolderItem({
  label,
  meta,
  isExpanded,
  variant = "project",
  onClick,
  right,
  children,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const panelId = useId();
  const reduce = useReducedMotion();

  const iconSize = variant === "project" ? 44 : 30;
  const state = isExpanded ? "open" : hovered ? "peek" : "rest";

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left",
          "transition-colors duration-150",
          "hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none",
          "focus-visible:ring-1 focus-visible:ring-primary/60",
          isExpanded && "bg-white/5",
          variant === "survey" && "pl-3",
        )}
      >
        <FolderIcon
          state={state}
          size={iconSize}
          accentClass={
            variant === "project" ? "fill-primary" : "fill-primary/70"
          }
        />

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate font-medium tracking-tight",
              variant === "project"
                ? "text-[13px] text-foreground"
                : "text-[12px] text-foreground/90",
            )}
          >
            {label}
          </div>
          {meta && (
            <div className="truncate text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
              {meta}
            </div>
          )}
        </div>

        {right && <div className="shrink-0">{right}</div>}
      </button>

      {/* Expanded panel (children) */}
      <AnimatePresence initial={false}>
        {isExpanded && children && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{
              duration: reduce ? 0 : 0.25,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "flex flex-col gap-1 border-l border-border/60 py-1 pl-3",
                variant === "project" ? "ml-5" : "ml-3",
              )}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
