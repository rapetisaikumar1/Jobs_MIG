"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

/**
 * Wraps a one-time success alert that a page shows because of a `?notice=…` query parameter
 * (e.g. "Job updated." after saving). The alert shows on that first render; right after, the
 * parameter is removed from the address bar with history.replaceState (no refetch, no
 * re-render of the page), so the alert does not come back on a reload, after Back / Cancel, or
 * next to a later message such as "Role saved.".
 *
 * Whether to show is decided once, on mount, from the URL. Next.js keeps useSearchParams in
 * sync with history.replaceState, so a later remount (Back to this page) sees the cleaned URL
 * and stays hidden.
 */
export function FlashNotice({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const [visible] = React.useState(() => searchParams.has("notice"));

  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("notice")) return;
    url.searchParams.delete("notice");
    // `null` state: Next.js then keeps its own history state and syncs its router with the new URL.
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  return visible ? <>{children}</> : null;
}
