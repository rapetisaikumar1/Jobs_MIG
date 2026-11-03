import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-foreground",
        info: "border-blue-200 bg-blue-50 text-info",
        progress: "border-amber-200 bg-amber-50 text-warning",
        success: "border-green-200 bg-green-50 text-success",
        danger: "border-red-200 bg-red-50 text-destructive",
        muted: "border-border bg-background text-muted-foreground",
        dark: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border bg-background text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  dot,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
