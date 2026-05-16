import * as React from "react";
import { cn } from "../../lib/utils.js";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "btn-primary-themed text-white border-[color:color-mix(in_srgb,var(--page-accent-400)_44%,transparent)] shadow-[0_8px_22px_var(--page-accent-900-shadow)]",
  secondary:
    "bg-slate-900/52 border-[color:var(--app-glass-panel-border)] text-slate-200 hover:bg-slate-900/72 backdrop-blur-md",
  ghost: "bg-transparent border-transparent text-slate-300 hover:text-white hover:bg-slate-900/55",
  danger:
    "bg-gradient-to-r from-red-700/92 to-red-600/92 text-white border-red-500/30 hover:from-red-600 hover:to-red-500",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-xs rounded-md",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-6 py-2.5 text-base rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium border transition-all duration-180 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--page-accent-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
