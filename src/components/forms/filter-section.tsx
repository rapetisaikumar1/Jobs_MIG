"use client";

import * as React from "react";

/** Collapsible filter group that keeps its own open/closed state across live result updates. */
export function FilterSection({ initialOpen, className, children }: { initialOpen: boolean; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      {children}
    </details>
  );
}
