import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { cleanupAbandonedUploads, purgeExpiredRateLimits } from "@/modules/documents/service";

/** Daily job (Vercel Cron): removes uploads never attached to a profile or application. */
export async function GET(request: NextRequest) {
  const secret = serverEnv.cronSecret;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authorized =
    !!secret && provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!authorized) return new NextResponse("Unauthorized", { status: 401 });

  const [removed, rateLimitsPurged] = await Promise.all([cleanupAbandonedUploads(24), purgeExpiredRateLimits()]);
  return NextResponse.json({ removed, rateLimitsPurged });
}
