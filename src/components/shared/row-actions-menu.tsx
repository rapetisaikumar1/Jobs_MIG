"use client";

import * as React from "react";
import Link from "next/link";
import { EllipsisVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type RowAction = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  /** Open in a new tab (e.g. viewing a PDF). */
  newTab?: boolean;
};

const MENU_WIDTH = 192; // w-48
const GAP = 4;

/**
 * The ⋮ button at the end of a table row with a small list of links. It is a disclosure
 * (button + list of links), closed by Escape, a click outside, focus leaving it, or scrolling.
 * The list is position: fixed so it is never clipped by a scrolling table container.
 */
export function RowActionsMenu({ actions, label = "Actions", className }: { actions: RowAction[]; label?: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [style, setStyle] = React.useState<React.CSSProperties>({});
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLUListElement>(null);
  const id = React.useId();

  const close = React.useCallback((focusButton = false) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }, []);

  // Place the list under the button (or above it when there is no room below).
  React.useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const below = rect.bottom + GAP + height <= window.innerHeight - 8;
    setStyle(below ? { left, top: rect.bottom + GAP } : { left, top: Math.max(8, rect.top - GAP - height) });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close(true);
    }
    function onScrollOrResize() {
      close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, close]);

  if (!actions.length) return null;

  const itemClass =
    "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

  return (
    <div
      ref={rootRef}
      data-no-row-click
      className={cn("relative inline-flex", className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-expanded:bg-accent aria-expanded:text-foreground"
      >
        <EllipsisVertical className="size-4" aria-hidden />
      </button>
      {open && (
        <ul
          ref={menuRef}
          id={id}
          style={{ ...style, width: MENU_WIDTH }}
          className="fixed z-50 rounded-md border bg-popover p-1 text-left shadow-md"
        >
          {actions.map((action) => (
            <li key={`${action.label}-${action.href}`}>
              {action.newTab || action.href.startsWith("/api/") ? (
                <a
                  href={action.href}
                  className={itemClass}
                  onClick={() => close()}
                  {...(action.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {action.icon}
                  {action.label}
                </a>
              ) : (
                <Link href={action.href} className={itemClass} onClick={() => close()}>
                  {action.icon}
                  {action.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
