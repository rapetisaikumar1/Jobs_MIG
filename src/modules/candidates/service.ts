import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { replaceCandidateSkills } from "@/modules/candidates/skills";
import { refreshCandidateSearchVector } from "@/modules/candidates/search-vector";
import type { CandidateSelfProfileInput } from "@/modules/candidates/schemas";

/** Maps validated profile fields to Prisma columns. */
function profileData(input: CandidateSelfProfileInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    alternatePhone: input.alternatePhone ?? null,
    country: input.country,
    state: input.state ?? null,
    city: input.city ?? null,
    postalCode: input.postalCode?.toUpperCase() ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
    professionalTitle: input.professionalTitle ?? null,
    currentTitle: input.currentTitle ?? null,
    currentEmployer: input.currentEmployer ?? null,
    totalExperienceYears: input.totalExperienceYears ?? null,
    relevantExperienceYears: input.relevantExperienceYears ?? null,
    highestQualification: input.highestQualification ?? null,
    education: input.education ?? null,
    certifications: input.certifications,
    preferredJobTitles: input.preferredJobTitles,
    preferredLocations: input.preferredLocations,
    preferredWorkArrangements: input.preferredWorkArrangements,
    preferredEmploymentTypes: input.preferredEmploymentTypes,
    expectedCompensation: input.expectedCompensation ?? null,
    compensationType: input.compensationType ?? null,
    currency: input.currency ?? null,
    noticePeriodDays: input.noticePeriodDays ?? null,
    availableFrom: input.availableFrom ?? null,
    workAuthCountry: input.workAuthCountry ?? null,
    workAuthStatus: input.workAuthStatus ?? null,
  } satisfies Prisma.CandidateProfileUpdateInput;
}

/** Candidate updating their own profile. Earlier application snapshots are untouched. */
export async function updateOwnProfile(candidateId: string, input: CandidateSelfProfileInput): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const profile = await tx.candidateProfile.update({ where: { id: candidateId }, data: profileData(input), select: { userId: true } });
    // The account row carries the name shown in the site header; keep it in step with the profile.
    if (profile.userId) {
      await tx.user.update({ where: { id: profile.userId }, data: { firstName: input.firstName, lastName: input.lastName } });
    }
    await replaceCandidateSkills(tx, candidateId, input.primarySkills, input.secondarySkills);
    await refreshCandidateSearchVector(candidateId, tx);
  });
}
