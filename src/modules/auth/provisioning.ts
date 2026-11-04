import "server-only";
import { Prisma, type Country, type User } from "@prisma/client";
import type { User as AuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/format";
import { refreshCandidateSearchVector } from "@/modules/candidates/search-vector";

/** Metadata stored on the Supabase Auth user at registration. */
export type CandidateSignupMetadata = {
  account_type: "candidate";
  first_name: string;
  last_name: string;
  phone: string;
  country: Country;
};

/** Candidates may also sign up with Google; Google only issues verified email addresses. */
export function isGoogleUser(authUser: AuthUser): boolean {
  const app = (authUser.app_metadata ?? {}) as { provider?: string; providers?: string[] };
  return app.provider === "google" || (app.providers ?? []).includes("google");
}

/** First and last name from the sign-up form, or from the Google profile. */
function signupName(authUser: AuthUser): { firstName: string; lastName: string } {
  const meta = (authUser.user_metadata ?? {}) as Partial<CandidateSignupMetadata> & {
    given_name?: string;
    family_name?: string;
    full_name?: string;
    name?: string;
  };
  if (meta.first_name?.trim()) return { firstName: meta.first_name.trim(), lastName: meta.last_name?.trim() ?? "" };
  if (meta.given_name?.trim()) return { firstName: meta.given_name.trim(), lastName: meta.family_name?.trim() ?? "" };
  const full = (meta.full_name ?? meta.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (full.length) return { firstName: full[0].slice(0, 80), lastName: full.slice(1).join(" ").slice(0, 80) };
  return { firstName: "Candidate", lastName: "" };
}

/**
 * Returns the application user for an authenticated Supabase user, creating the
 * candidate account and profile on first sign-in after email verification
 * (sign-up form + code) or after the first Google sign-in.
 *
 * Duplicate handling: if a recruiter already created an internal profile with the
 * same (now verified) email address, that profile is linked to the new account
 * instead of creating a second record. Staff-only fields are never shown to candidates.
 */
export async function ensureCandidateAccount(authUser: AuthUser): Promise<User | null> {
  const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (existing) return existing;

  const meta = (authUser.user_metadata ?? {}) as Partial<CandidateSignupMetadata>;
  if ((meta.account_type !== "candidate" && !isGoogleUser(authUser)) || !authUser.email || !authUser.email_confirmed_at) return null;

  const email = authUser.email.toLowerCase();
  const country: Country = meta.country === "US" || meta.country === "CA" ? meta.country : "OTHER";
  const { firstName, lastName } = signupName(authUser);

  try {
    const { user, profileId } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: authUser.id,
          email,
          firstName,
          lastName,
          type: "CANDIDATE",
        },
      });

      const unclaimed = await tx.candidateProfile.findUnique({ where: { email } });
      if (unclaimed) {
        if (unclaimed.userId) throw new Error("Candidate profile is already linked to another account");
        await tx.candidateProfile.update({ where: { id: unclaimed.id }, data: { userId: user.id } });
        return { user, profileId: unclaimed.id };
      }

      const profile = await tx.candidateProfile.create({
        data: {
          userId: user.id,
          source: "JOB_PORTAL",
          firstName: user.firstName,
          lastName: user.lastName,
          email,
          phone: normalizePhone(meta.phone),
          country,
        },
      });
      return { user, profileId: profile.id };
    });
    await refreshCandidateSearchVector(profileId);
    return user;
  } catch (error) {
    // A concurrent request provisioned the account first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.user.findUnique({ where: { id: authUser.id } });
    }
    throw error;
  }
}
