import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/format";

export const TIME_ZONE_COOKIE = "mig_tz";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Viewer's time zone, reported by the browser via cookie (see TimeZoneSync). */
export async function getViewerTimeZone(): Promise<string> {
  const tz = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}
