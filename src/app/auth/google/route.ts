import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/modules/auth/redirects";
import { googleDirectConfig, startGoogleSignIn } from "@/modules/auth/google";

/**
 * Starts "Continue with Google" for the job portal. With GOOGLE_SIGNIN_ON_SITE enabled (see auth/google.ts),
 * Google returns to this site (/auth/google/callback), so Google's screens name our domain.
 * Otherwise Supabase issues the Google URL and Google returns via Supabase to /auth/callback.
 * A plain GET link (not a form post) so the CSP form-action rule never blocks the hop.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const requested = safeNextPath(searchParams.get("next"), "/candidate/dashboard");
  // Job portal only: never carry an admin destination through this flow.
  const next = requested.startsWith("/admin") ? "/candidate/dashboard" : requested;

  try {
    await enforceRateLimit("oauthStart");
  } catch {
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }

  const direct = googleDirectConfig();
  if (direct) return startGoogleSignIn(direct.clientId, next);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${serverEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("[auth] google sign-in could not start", error?.code, error?.message);
    return NextResponse.redirect(new URL("/login?error=google", origin));
  }
  return NextResponse.redirect(data.url);
}
