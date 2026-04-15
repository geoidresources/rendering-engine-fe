"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

interface AppButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  isDisabled?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  radius?: "none" | "sm" | "md";
  className?: string;
  onPress?: () => void;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
}

/**
 * HUD-styled button. Wraps shadcn buttonVariants pattern with framer-motion
 * for tactile press feedback and AnimatePresence for loading state swaps.
 *
 * Maps app-specific variant names (primary/secondary/danger/success) onto
 * shadcn semantic colors via custom variant definitions below.
 */
const appButtonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 font-medium cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground font-semibold hover:bg-primary-hover shadow-[var(--glow-accent)] hover:shadow-[0_0_16px_rgba(245,210,89,0.35)]",
        secondary:
          "bg-transparent text-foreground border border-border hover:border-foreground/60",
        outline:
          "bg-transparent border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        danger:
          "bg-destructive text-destructive-foreground font-semibold hover:brightness-110",
        success:
          "bg-[var(--color-success)] text-bg-base font-semibold hover:brightness-110",
      },
      size: {
        sm: "px-3 py-1.5 text-[10px] uppercase tracking-wider",
        md: "px-5 py-2.5 text-xs uppercase tracking-wider",
        lg: "px-7 py-3.5 text-sm uppercase tracking-wider",
      },
      radius: {
        none: "rounded-none",
        sm: "rounded-sm",
        md: "rounded-md",
      },
      fullWidth: {
        true: "w-full",
        false: "w-fit",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      radius: "sm",
      fullWidth: false,
    },
  },
);

export default function AppButton({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  isDisabled = false,
  startIcon,
  endIcon,
  startContent,
  endContent,
  radius = "sm",
  className = "",
  onPress,
  type = "button",
  fullWidth = false,
}: AppButtonProps) {
  return (
    <motion.button
      whileTap={!isDisabled && !isLoading ? { scale: 0.97 } : {}}
      className={cn(appButtonVariants({ variant, size, radius, fullWidth }), className)}
      disabled={isDisabled || isLoading}
      onClick={onPress}
      type={type}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="animate-spin" size={size === "sm" ? 12 : size === "lg" ? 18 : 14} />
            <span>Processing...</span>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            {(startIcon || startContent) && <span className="shrink-0">{startIcon || startContent}</span>}
            {children}
            {(endIcon || endContent) && <span className="shrink-0">{endIcon || endContent}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
