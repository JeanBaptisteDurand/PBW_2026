import * as React from "react";
import { cn } from "../../lib/utils.js";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-lg bg-slate-900/80 border border-[color:var(--app-glass-panel-border)] px-3 py-2 text-sm text-white placeholder:text-slate-500 backdrop-blur-sm",
            "focus:outline-none focus:ring-2 focus:ring-xrp-400 focus:border-xrp-400",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors duration-150",
            error && "border-red-500 focus:ring-red-500",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
