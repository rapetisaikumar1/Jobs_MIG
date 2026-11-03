import * as React from "react";
import { cn } from "@/lib/utils";

export type DetailItem = { label: string; value: React.ReactNode; wide?: boolean };

/** Label/value grid for record details. Empty values render as an em dash. */
export function DetailList({ items, className, columns = 2 }: { items: DetailItem[]; className?: string; columns?: 1 | 2 | 3 }) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4 text-sm",
        columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className={cn("min-w-0", item.wide && "sm:col-span-full")}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words">{item.value === null || item.value === undefined || item.value === "" ? "—" : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TagList({ items, empty = "—" }: { items: string[]; empty?: string }) {
  if (!items.length) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-md border bg-muted px-2 py-0.5 text-xs">
          {item}
        </span>
      ))}
    </div>
  );
}
