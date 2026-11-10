import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { finishGoogleSignIn } from "@/modules/auth/google";
import { safeNextPath } from "@/modules/auth/redirects";

/**
 * Return leg of the Supabase-hosted "Continue with Google" flow (job portal only). Exchanges
 * the one-time code for a session, then the shared finish step creates the candidate account on
 * first sign-in and turns staff accounts away. (The direct flow returns to /auth/google/callback.)
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
  return finishGoogleSignIn(supabase, authUser, next, origin);
}
