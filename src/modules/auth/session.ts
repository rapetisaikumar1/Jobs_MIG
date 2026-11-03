import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User as AuthUser } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/action-result";
import { ensureCandidateAccount } from "@/modules/auth/provisioning";

/** Authenticated Supabase user for this request (verified with the Auth server). */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
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

async function loadCandidateContext() {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  const account = await ensureCandidateAccount(authUser);
  if (!account || account.type !== "CANDIDATE" || !account.isActive) return null;
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: account.id } });
  if (!profile) return null;
  return { user: account, profile, authUser };
}

export const getCandidateContext = cache(loadCandidateContext);

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
  const authUser = await getAuthUser();
  if (!authUser || isSessionTooOld(authUser, serverEnv.candidateSessionMaxHours)) {
    throw new ForbiddenError("Your session has expired. Please sign in again.");
  }
  const ctx = await getCandidateContext();
  if (!ctx) throw new ForbiddenError("A candidate account is required.");
  return ctx;
}
