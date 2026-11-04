"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const SHOW_AFTER_MS = 150; // fast navigations finish before anything appears (no flicker)
const GIVE_UP_MS = 15_000; // safety net if a navigation never changes the URL

/**
 * Site-wide loading indicator: a slim bar at the top and a small spinner while a page is loading
 * after a click on an internal link, a GET form submit, or back/forward. Purely visual — it only
 * watches navigation and never changes it.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = React.useState(false);
  const timers = React.useRef<{ show?: ReturnType<typeof setTimeout>; stop?: ReturnType<typeof setTimeout> }>({});

  const stop = React.useCallback(() => {
    clearTimeout(timers.current.show);
    clearTimeout(timers.current.stop);
    setVisible(false);
  }, []);

  const start = React.useCallback(() => {
    clearTimeout(timers.current.show);
    clearTimeout(timers.current.stop);
    timers.current.show = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    timers.current.stop = setTimeout(() => setVisible(false), GIVE_UP_MS);
  }, []);

  // The new page has rendered once the URL changes.
  React.useEffect(() => stop(), [pathname, searchParams, stop]);

  React.useEffect(() => {
    function sameDocument(url: URL) {
      return url.pathname === window.location.pathname && url.search === window.location.search;
    }
    // Capture phase: Next.js <Link> calls preventDefault() to navigate client-side, so a bubbling
    // listener would never see link clicks.
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || sameDocument(url)) return; // external, hash-only or same page
      if (url.pathname.startsWith("/api/")) return; // file downloads
      start();
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement;
      // Only plain GET forms that the browser will actually submit (filters, search). Forms handled
      // in JavaScript prevent the default and show their own button spinner.
      if (e.defaultPrevented || form.getAttribute("method")?.toLowerCase() !== "get") return;
      start();
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("popstate", start);
    };
  }, [start]);

  if (!visible) return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-brand/15" role="progressbar" aria-label="Loading page">
        <div className="nav-progress-bar h-full w-1/3 rounded-full bg-brand" />
      </div>
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex size-8 items-center justify-center rounded-full border bg-background/95 shadow-md" aria-hidden>
        <Loader2 className="size-4 animate-spin text-brand" />
      </div>
      <span className="sr-only" role="status">Loading…</span>
    </>
  );
}
