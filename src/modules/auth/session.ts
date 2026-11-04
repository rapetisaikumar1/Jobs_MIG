import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User as AuthUser } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/action-result";
import { ensureCandidateAccount } from "@/modules/auth/provisioning";

type SessionClaims = {
  sub?: string;
  aud?: string | string[];
  email?: string;
  app_metadata?: AuthUser["app_metadata"];
  user_metadata?: AuthUser["user_metadata"];
  amr?: { method: string; timestamp: number }[];
  iat?: number;
};

/**
 * Signed-in user for this request, from the session's access token. getClaims() verifies the
 * token's signature locally against the project's signing keys (ES256, cached in-process) and
 * its expiry, so page renders don't wait on a round trip to the Auth server. Revocation and
 * deactivation are still enforced on every request through the app database (users.is_active),
 * and data-changing actions re-confirm the user with the Auth server (getAuthUserStrict).
 *
 * The returned object carries only what the token proves: id, email, metadata and the session's
 * sign-in time (as last_sign_in_at, from the "amr" claim). It has no email_confirmed_at, so it
 * can never be used to create an account; provisioning uses getAuthUserStrict().
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as SessionClaims | undefined;
  if (!claims?.sub) return null;
  const signedInAt = claims.amr?.length ? Math.max(...claims.amr.map((a) => a.timestamp)) : claims.iat;
  return {
    id: claims.sub,
    aud: Array.isArray(claims.aud) ? claims.aud[0] : (claims.aud ?? "authenticated"),
    email: claims.email,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
    last_sign_in_at: signedInAt ? new Date(signedInAt * 1000).toISOString() : undefined,
    created_at: "",
  } as AuthUser;
});

/** Signed-in user confirmed with the Auth server (detects revoked sessions and deleted logins). */
export const getAuthUserStrict = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

/** Sessions older than the configured maximum must sign in again. */
export function isSessionTooOld(user: AuthUser, maxHours: number, now = Date.now()): boolean {
  if (!user.last_sign_in_at) return false;
  return now - new Date(user.last_sign_in_at).getTime() > maxHours * 60 * 60 * 1000;
}

export type CandidateContext = Awaited<ReturnType<typeof loadCandidateContext>>;

/** The app's user row for this request, shared by the candidate context and the site header. */
export const getAppUser = cache(async (id: string) => prisma.user.findUnique({ where: { id } }));

async function buildCandidateContext(authUser: AuthUser | null) {
  if (!authUser) return null;
  // Sessions past the candidate maximum age get no access anywhere (pages, documents, uploads).
  if (isSessionTooOld(authUser, serverEnv.candidateSessionMaxHours)) return null;
  // The account and profile rows are independent lookups; run them together.
  let [account, profile] = await Promise.all([
    getAppUser(authUser.id),
    prisma.candidateProfile.findUnique({ where: { userId: authUser.id } }),
  ]);
  if (!account) {
    // First sign-in after verification: create the account from the Auth server's record
    // (it has email_confirmed_at), never from token claims alone.
    const confirmed = authUser.email_confirmed_at ? authUser : await getAuthUserStrict();
    if (!confirmed || confirmed.id !== authUser.id) return null;
    account = await ensureCandidateAccount(confirmed);
    if (account) profile = await prisma.candidateProfile.findUnique({ where: { userId: account.id } });
  }
  if (!account || account.type !== "CANDIDATE" || !account.isActive) return null;
  if (!profile) return null;
  return { user: account, profile, authUser };
}

async function loadCandidateContext() {
  return buildCandidateContext(await getAuthUser());
}

export const getCandidateContext = cache(loadCandidateContext);

/** Candidate context confirmed with the Auth server, for actions that change data. */
export const getCandidateContextStrict = cache(async () => buildCandidateContext(await getAuthUserStrict()));

/** For candidate pages: redirects unauthenticated users and staff away. */
export async function requireCandidate(next?: string) {
  const authUser = await getAuthUser();
  if (!authUser) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (isSessionTooOld(authUser, serverEnv.candidateSessionMaxHours)) redirect("/auth/signout?expired=1");
  const ctx = await getCandidateContext();
  if (!ctx) {
    const appUser = await prisma.user.findUnique({ where: { id: authUser.id }, select: { type: true } });
    if (appUser?.type === "STAFF") redirect("/admin/jobs");
    redirect("/auth/signout?inactive=1");
  }
  return ctx;
}

/** For candidate server actions: throws instead of redirecting. */
export async function requireCandidateForAction() {
  const authUser = await getAuthUserStrict();
  if (!authUser || isSessionTooOld(authUser, serverEnv.candidateSessionMaxHours)) {
    throw new ForbiddenError("Your session has expired. Please sign in again.");
  }
  const ctx = await getCandidateContextStrict();
  if (!ctx) throw new ForbiddenError("A candidate account is required.");
  return ctx;
}
