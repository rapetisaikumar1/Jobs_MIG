import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureCandidateAccount } from "@/modules/auth/provisioning";
import { safeNextPath } from "@/modules/auth/redirects";

/**
 * Return leg of "Continue with Google" (job portal only). Exchanges the one-time code
 * for a session, then creates the candidate account on first sign-in. Staff accounts
 * are turned away here; they keep using the staff sign-in page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));
  const requested = safeNextPath(searchParams.get("next"), "/candidate/dashboard");
  const next = requested.startsWith("/admin") ? "/candidate/dashboard" : requested;

  const code = searchParams.get("code");
  // Google returns ?error=access_denied when the user cancels the account picker.
  if (!code) return to(searchParams.get("error") === "access_denied" ? "/login" : "/login?error=google");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const authUser = data.user;
  if (error || !authUser) {
    if (error) console.error("[auth] google sign-in failed", error.code, error.message);
    return to("/login?error=google");
  }

  const existing = await prisma.user.findUnique({ where: { id: authUser.id }, select: { type: true } });
  if (existing?.type === "STAFF") {
    await supabase.auth.signOut({ scope: "local" });
    return to("/login?error=staff");
  }

  const account = await ensureCandidateAccount(authUser);
  if (!account || !account.isActive) {
    await supabase.auth.signOut({ scope: "local" });
    return to("/login?inactive=1");
  }
  // First Google sign-in: send them to complete the profile (phone, location, skills).
  return to(existing ? next : "/candidate/profile?welcome=1");
}
