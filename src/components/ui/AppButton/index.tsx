"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AppButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  isDisabled?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  startContent?: React.ReactNode; // Alias for HeroUI compatibility
  endContent?: React.ReactNode;   // Alias for HeroUI compatibility
  radius?: "none" | "sm" | "md" | "lg" | "full";
  className?: string;
  onPress?: () => void;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
}

/**
 * Global Premium AppButton Component
 * Encapsulates consistent styling, loading states, and micro-animations.
 */
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
  radius = "full",
  className = "",
  onPress,
  type = "button",
  fullWidth = false,
}: AppButtonProps) {
  
  // Radius mapping
  const radiusStyles = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  };

  // Base variant styles
  const variantStyles = {
    primary: "bg-blue-600 dark:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:bg-blue-500 dark:hover:bg-blue-400",
    secondary: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700",
    outline: "bg-transparent border-2 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
    ghost: "bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200",
    danger: "bg-red-600 dark:bg-red-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:bg-red-500 dark:hover:bg-red-400",
    success: "bg-emerald-600 dark:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:bg-emerald-500 dark:hover:bg-emerald-400",
  };

  // Size styles
  const sizeStyles = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  const combinedClasses = `
    relative flex items-center justify-center gap-2 font-semibold
    transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${radiusStyles[radius]}
    ${fullWidth ? "w-full" : "w-fit"}
    ${className}
  `.replace(/\s+/g, " ").trim();

  return (
    <motion.button
      whileTap={!isDisabled && !isLoading ? { scale: 0.96 } : {}}
      className={combinedClasses}
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
            <Loader2 className="animate-spin" size={size === "sm" ? 14 : size === "lg" ? 20 : 16} />
            <span className="text-[12px] font-medium">Processing...</span>
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
