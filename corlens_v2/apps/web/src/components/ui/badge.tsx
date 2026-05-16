import type * as React from "react";
import { cn } from "../../lib/utils.js";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "high" | "med" | "low" | "info";
};

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-slate-800/36 text-slate-300 border border-slate-600/35",
  high: "bg-red-500/18 text-red-300 border border-red-500/35",
  med: "bg-amber-500/18 text-amber-300 border border-amber-500/35",
  low: "bg-emerald-500/16 text-emerald-300 border border-emerald-500/32",
  info: "bg-xrp-500/18 text-xrp-300 border border-xrp-500/35",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
