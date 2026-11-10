import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/modules/auth/redirects";
import {
  GOOGLE_STATE_COOKIE,
  clearGoogleStateCookie,
  exchangeGoogleCode,
  finishGoogleSignIn,
  googleDirectConfig,
  readGoogleState,
  statesMatch,
} from "@/modules/auth/google";

/**
 * Google returns here in the direct flow (see modules/auth/google.ts). Checks the state against
 * this browser's cookie (CSRF), exchanges the code for Google's ID token, signs in to Supabase
 * with it, then runs the same finish step as the Supabase-hosted flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const fail = (path: string) => clearGoogleStateCookie(NextResponse.redirect(new URL(path, origin)));

  const cfg = googleDirectConfig();
  const saved = readGoogleState(request.cookies.get(GOOGLE_STATE_COOKIE)?.value);
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  // Cancelled at Google's account picker.
  if (searchParams.get("error") === "access_denied") return fail("/login");
  if (!cfg || !saved || !state || !code || !statesMatch(state, saved.state)) return fail("/login?error=google");

  const requested = safeNextPath(saved.next, "/candidate/dashboard");
  const next = requested.startsWith("/admin") ? "/candidate/dashboard" : requested;

  try {
    const { idToken, accessToken } = await exchangeGoogleCode(code, cfg);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, access_token: accessToken, nonce: saved.nonce });
    if (error || !data.user) {
      if (error) console.error("[auth] google id-token sign-in failed", error.code, error.message);
      return fail("/login?error=google");
    }
    return clearGoogleStateCookie(await finishGoogleSignIn(supabase, data.user, next, origin));
  } catch (error) {
    console.error("[auth] google sign-in failed", error instanceof Error ? error.message : error);
    return fail("/login?error=google");
  }
}
