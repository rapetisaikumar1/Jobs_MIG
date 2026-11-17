import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * "Scroll shadows": a soft shadow appears at the left / right edge only while there is more of
 * the table to scroll to on that side. Pure CSS: the two card-coloured cover gradients scroll
 * with the content (background-attachment: local) and hide the two fixed shadow gradients once
 * an edge is reached. Tables always sit on a card, so the covers match the background.
 */
const scrollShadows =
  "[background:linear-gradient(to_right,var(--card)_30%,transparent)_left_center/2.5rem_100%_no-repeat_local,linear-gradient(to_left,var(--card)_30%,transparent)_right_center/2.5rem_100%_no-repeat_local,radial-gradient(farthest-side_at_0_50%,rgb(0_0_0/0.14),transparent)_left_center/0.75rem_100%_no-repeat_scroll,radial-gradient(farthest-side_at_100%_50%,rgb(0_0_0/0.14),transparent)_right_center/0.75rem_100%_no-repeat_scroll]";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className={cn("relative w-full overflow-x-auto", scrollShadows)}>
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-muted/50 [&_tr]:border-b [&_tr]:hover:bg-transparent", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/30", className)} {...props} />;
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("h-10 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}
