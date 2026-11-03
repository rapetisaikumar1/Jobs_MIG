"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const COOKIE = "mig_tz";

/**
 * Reports the browser's time zone to the server (cookie) so server-rendered dates
 * display in the viewer's local time. Timestamps are always stored in UTC.
 */
export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    const current = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`))?.split("=")[1];
    if (current && decodeURIComponent(current) === tz) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
