import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/modules/auth/redirects";

/**
 * Starts "Continue with Google" for the job portal. Supabase issues the Google URL and
 * stores the PKCE verifier in a cookie; Google sends the user back to /auth/callback.
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
