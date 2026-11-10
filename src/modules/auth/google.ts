import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient, User as AuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import { ensureCandidateAccount } from "@/modules/auth/provisioning";

/**
 * "Continue with Google" handled on this site's own domain.
 *
 * Google's account picker names the site that receives the sign-in ("to continue to …").
 * With Supabase's hosted flow that was <project>.supabase.co, which looks untrustworthy and
 * can't pass Google brand verification. Here Google returns to <site>/auth/google/callback,
 * the app exchanges the code for Google's ID token, and signs in to Supabase with it
 * (signInWithIdToken), so sessions, accounts and everything after are unchanged.
 *
 * Opt-in: GOOGLE_SIGNIN_ON_SITE=true plus GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (the same OAuth
 * client configured in Supabase), after adding <site>/auth/google/callback to that client's
 * "Authorized redirect URIs" in Google Cloud. Otherwise the Supabase-hosted flow is used, as before.
 */
export function googleDirectConfig(): { clientId: string; clientSecret: string } | null {
  if (process.env.GOOGLE_SIGNIN_ON_SITE?.trim().toLowerCase() !== "true") return null;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const GOOGLE_STATE_COOKIE = "mig_google_oauth";
const COOKIE_PATH = "/auth/google";

export function googleRedirectUri() {
  return `${serverEnv.siteUrl}/auth/google/callback`;
}

const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

/** Builds Google's authorization URL and the short-lived cookie that binds the callback to this browser. */
export function startGoogleSignIn(clientId: string, next: string) {
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce: sha256Hex(nonce), // Supabase hashes the raw nonce and compares it with the token's claim
    prompt: "select_account",
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_STATE_COOKIE, Buffer.from(JSON.stringify({ state, nonce, next })).toString("base64url"), {
    httpOnly: true,
    secure: serverEnv.siteUrl.startsWith("https://"),
    sameSite: "lax", // sent on Google's top-level redirect back to us
    path: COOKIE_PATH,
    maxAge: 600,
  });
  return response;
}

export function readGoogleState(raw: string | undefined): { state: string; nonce: string; next: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString());
    return typeof v.state === "string" && typeof v.nonce === "string" && typeof v.next === "string" ? v : null;
  } catch {
    return null;
  }
}

export function statesMatch(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function clearGoogleStateCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  return response;
}

/** Exchanges the authorization code at Google's token endpoint (server to server, with the client secret). */
export async function exchangeGoogleCode(code: string, cfg: { clientId: string; clientSecret: string }) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; access_token?: string; error?: string };
  if (!res.ok || !body.id_token) throw new Error(`Google token exchange failed: ${res.status} ${body.error ?? ""}`.trim());
  return { idToken: body.id_token, accessToken: body.access_token };
}

/**
 * Shared last step of every Google sign-in: staff accounts are refused on the job portal, the
 * candidate account is created on first sign-in, then the user goes to their destination.
 */
export async function finishGoogleSignIn(supabase: SupabaseClient, authUser: AuthUser, next: string, origin: string) {
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));
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
