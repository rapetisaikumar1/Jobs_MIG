import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { safeNextPath } from "@/modules/auth/redirects";

/**
 * Handles links from Supabase Auth emails (sign-up verification, staff invitation,
 * password recovery). Supports the token-hash links recommended for server-side
 * rendering and the PKCE "code" links.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/candidate/dashboard");

  const supabase = await createSupabaseServerClient();
  let userId: string | undefined;
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) userId = data.user?.id;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) userId = data.user?.id;
  }

  if (!userId) return NextResponse.redirect(new URL("/login?error=link", origin));

  // Staff links (password recovery, invitations) finish on the admin portal, never the job portal.
  if (!next.startsWith("/admin/")) {
    const appUser = await prisma.user.findUnique({ where: { id: userId }, select: { type: true } });
    if (appUser?.type === "STAFF") {
      const isPasswordLink = type === "recovery" || type === "invite" || next.startsWith("/reset-password");
      return NextResponse.redirect(new URL(isPasswordLink ? "/admin/reset-password" : "/admin/jobs", origin));
    }
  }
  return NextResponse.redirect(new URL(next, origin));
}
