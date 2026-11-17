"use client";

import * as React from "react";
import { TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Elements that handle their own clicks; a click on them never opens the row. */
const INTERACTIVE = "a, button, input, select, textarea, summary, label, [data-no-row-click]";

/**
 * A table row that opens its main link (the one marked data-row-link) when any empty part of
 * the row is clicked. Keyboard and screen-reader users use that link directly, so the row
 * itself is not focusable and no interactive element is nested inside a link.
 */
export function ClickableRow({ className, children }: { className?: string; children: React.ReactNode }) {
  function onClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (e.defaultPrevented || e.button !== 0) return;
    if ((e.target as Element).closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return; // the user is selecting text
    const link = e.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]");
    if (!link) return;
    if (e.metaKey || e.ctrlKey) {
      window.open(link.href, "_blank", "noopener");
      return;
    }
    link.click(); // goes through Next.js <Link> (client navigation + loading indicator)
  }

  return (
    <TR className={cn("cursor-pointer hover:bg-muted/40", className)} onClick={onClick}>
      {children}
    </TR>
  );
}
