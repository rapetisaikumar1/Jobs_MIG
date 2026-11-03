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

/**
 * Returns the application user for an authenticated Supabase user, creating the
 * candidate account and profile on first sign-in after email verification.
 *
 * Duplicate handling: if a recruiter already created an internal profile with the
 * same (now verified) email address, that profile is linked to the new account
 * instead of creating a second record. Staff-only fields are never shown to candidates.
 */
export async function ensureCandidateAccount(authUser: AuthUser): Promise<User | null> {
  const existing = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (existing) return existing;

  const meta = (authUser.user_metadata ?? {}) as Partial<CandidateSignupMetadata>;
  if (meta.account_type !== "candidate" || !authUser.email || !authUser.email_confirmed_at) return null;

  const email = authUser.email.toLowerCase();
  const country: Country = meta.country === "US" || meta.country === "CA" ? meta.country : "OTHER";

  try {
    const { user, profileId } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: authUser.id,
          email,
          firstName: meta.first_name?.trim() || "Candidate",
          lastName: meta.last_name?.trim() || "",
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
