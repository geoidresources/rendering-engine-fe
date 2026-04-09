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
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  radius?: "none" | "sm" | "md";
  className?: string;
  onPress?: () => void;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
}

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
  const radiusStyles = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
  };

  const variantStyles = {
    primary:
      "bg-accent text-bg-base font-semibold hover:bg-accent-hover shadow-[var(--glow-accent)] hover:shadow-[0_0_16px_rgba(245,210,89,0.35)]",
    secondary:
      "bg-transparent text-primary border border-border-subtle hover:border-primary hover:text-primary-hover",
    outline:
      "bg-transparent border border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-muted",
    ghost:
      "bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
    danger:
      "bg-error text-bg-base font-semibold hover:brightness-110",
    success:
      "bg-success text-bg-base font-semibold hover:brightness-110",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-[10px] uppercase tracking-wider",
    md: "px-5 py-2.5 text-xs uppercase tracking-wider",
    lg: "px-7 py-3.5 text-sm uppercase tracking-wider",
  };

  const combinedClasses = `
    relative flex items-center justify-center gap-2 font-medium cursor-pointer
    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${radiusStyles[radius]}
    ${fullWidth ? "w-full" : "w-fit"}
    ${className}
  `.replace(/\s+/g, " ").trim();

  return (
    <motion.button
      whileTap={!isDisabled && !isLoading ? { scale: 0.97 } : {}}
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
