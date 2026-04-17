"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * State machine for the folder animation:
 *   rest  — idle, paper tucked fully inside
 *   peek  — hover / parent selected but not expanded: paper nudges out slightly
 *   open  — expanded: paper fully out & up, folder front flap tilts open
 */
export type FolderState = "rest" | "peek" | "open";

interface Props {
  state: FolderState;
  /** Visual size in pixels — width of the folder. Default 44 (project). Use ~28 for surveys. */
  size?: number;
  /** Accent color for the folder tab (defaults to the --primary design token). */
  accentClass?: string;
  className?: string;
}

/**
 * Layered folder icon.
 *
 * z-order (back → front):
 *   1. Folder back (static body + tab)
 *   2. Paper(s)   (tween y / scale / rotate based on state)
 *   3. Folder front flap (tilts open on `open`)
 */
export function FolderIcon({
  state,
  size = 44,
  accentClass = "fill-primary",
  className,
}: Props) {
  const reduce = useReducedMotion();
  const height = Math.round(size * 0.82);

  // Paper animation variants — two sheets, offset for depth.
  const paperVariants = {
    rest: { y: 0, scale: 1, rotate: 0, opacity: 0.92 },
    peek: { y: -4, scale: 1.02, rotate: -1.5, opacity: 1 },
    open: { y: -14, scale: 1.06, rotate: -2, opacity: 1 },
  } as const;

  const paperBackVariants = {
    rest: { y: 0, scale: 1, rotate: 0, opacity: 0.85 },
    peek: { y: -2, scale: 1.01, rotate: 1, opacity: 0.95 },
    open: { y: -8, scale: 1.03, rotate: 2, opacity: 1 },
  } as const;

  // Front flap rotates down/open around its bottom edge.
  const frontVariants = {
    rest: { rotateX: 0, y: 0 },
    peek: { rotateX: -4, y: 0 },
    open: { rotateX: -38, y: 1 },
  } as const;

  const transition = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 22 };

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{
        width: size,
        height,
        perspective: 600,
      }}
      aria-hidden="true"
    >
      {/* Folder back (tab + body) */}
      <svg
        viewBox="0 0 100 82"
        className="absolute inset-0"
        width={size}
        height={height}
      >
        {/* Tab */}
        <path
          d="M6 10 Q6 4 12 4 H38 L44 12 H6 Z"
          className={accentClass}
          opacity={0.9}
        />
        {/* Back body (darker) */}
        <path
          d="M4 14 Q4 10 10 10 H90 Q96 10 96 16 V72 Q96 78 90 78 H10 Q4 78 4 72 Z"
          className="fill-zinc-800"
        />
        {/* Subtle inner highlight */}
        <path
          d="M4 14 Q4 10 10 10 H90 Q96 10 96 16 V22 H4 Z"
          className="fill-white/5"
        />
      </svg>

      {/* Papers — back sheet */}
      <motion.div
        className="absolute left-[14%] right-[14%] top-[18%] bottom-[18%] origin-bottom"
        variants={paperBackVariants}
        animate={state}
        transition={transition}
      >
        <div className="h-full w-full rounded-[2px] bg-zinc-200 shadow-[0_1px_0_rgba(0,0,0,0.25)]">
          <div className="mx-auto mt-[22%] h-[6%] w-[60%] rounded-sm bg-zinc-400/70" />
          <div className="mx-auto mt-[8%] h-[6%] w-[50%] rounded-sm bg-zinc-400/50" />
        </div>
      </motion.div>

      {/* Papers — front sheet */}
      <motion.div
        className="absolute left-[12%] right-[12%] top-[14%] bottom-[18%] origin-bottom"
        variants={paperVariants}
        animate={state}
        transition={transition}
      >
        <div className="h-full w-full rounded-[2px] bg-white shadow-[0_2px_3px_rgba(0,0,0,0.35)]">
          <div className="mx-auto mt-[20%] h-[7%] w-[68%] rounded-sm bg-zinc-700/80" />
          <div className="mx-auto mt-[8%] h-[6%] w-[55%] rounded-sm bg-zinc-500/70" />
          <div className="mx-auto mt-[8%] h-[6%] w-[45%] rounded-sm bg-zinc-500/50" />
        </div>
      </motion.div>

      {/* Folder front flap — tilts open */}
      <motion.svg
        viewBox="0 0 100 82"
        className="absolute inset-0"
        width={size}
        height={height}
        style={{
          transformOrigin: "50% 100%",
          transformStyle: "preserve-3d",
        }}
        variants={frontVariants}
        animate={state}
        transition={transition}
      >
        <defs>
          <linearGradient id="folder-front-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(63 63 70)" />
            <stop offset="100%" stopColor="rgb(39 39 42)" />
          </linearGradient>
        </defs>
        <path
          d="M4 26 Q4 22 10 22 H90 Q96 22 96 28 V72 Q96 78 90 78 H10 Q4 78 4 72 Z"
          fill="url(#folder-front-grad)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={0.5}
        />
        {/* Top edge highlight to suggest the flap's thickness */}
        <path
          d="M4 26 Q4 22 10 22 H90 Q96 22 96 28 H4 Z"
          className="fill-white/10"
        />
      </motion.svg>
    </div>
  );
}
