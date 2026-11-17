"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * The header's phone menu (<details>/<summary>, so it works before JavaScript loads). Closes when
 * the page changes, when a link inside it is chosen, on Escape and on a tap outside it.
 */
export function MobileMenu({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  const close = React.useCallback(() => {
    if (ref.current?.open) ref.current.open = false;
  }, []);

  React.useEffect(close, [pathname, close]);

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        close();
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  return (
    <details
      ref={ref}
      className={className}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) close();
      }}
    >
      {children}
    </details>
  );
}
