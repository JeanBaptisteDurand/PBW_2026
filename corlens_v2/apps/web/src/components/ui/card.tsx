import * as React from "react";
import { cn } from "../../lib/utils.js";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("app-glass-surface rounded-xl", className)} {...props} />
));
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-6 py-4 border-b border-[color:var(--app-glass-panel-border)]", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardContent = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-6 py-4", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-lg font-semibold text-slate-100", className)} {...props} />
));
CardTitle.displayName = "CardTitle";
