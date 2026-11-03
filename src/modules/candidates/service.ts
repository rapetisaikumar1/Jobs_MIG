import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action-result";
import type { StaffContext } from "@/modules/access-control/context";
import { replaceCandidateSkills } from "@/modules/candidates/skills";
import { refreshCandidateSearchVector } from "@/modules/candidates/search-vector";
import type { CandidateSelfProfileInput, StaffCandidateInput } from "@/modules/candidates/schemas";
import { activateDocuments, verifyPendingUploads } from "@/modules/documents/service";

/** Maps validated profile fields to Prisma columns (shared by portal and admin). */
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
    await tx.candidateProfile.update({ where: { id: candidateId }, data: profileData(input) });
    await replaceCandidateSkills(tx, candidateId, input.primarySkills, input.secondarySkills);
    await refreshCandidateSearchVector(candidateId, tx);
  });
}

export type DuplicateMatch = { id: string; displayId: string; name: string; email: string; reason: string };

/**
 * Email is the primary matching signal and is unique. Same phone number or same
 * full name are weaker signals that require the recruiter to confirm manually.
 */
export async function findPossibleDuplicates(
  input: { email: string; phone?: string | null; firstName: string; lastName: string },
  excludeId?: string,
): Promise<{ emailMatch: DuplicateMatch | null; similar: DuplicateMatch[] }> {
  const toMatch = (c: { id: string; displayId: string; firstName: string; lastName: string; email: string }, reason: string) => ({
    id: c.id,
    displayId: c.displayId,
    name: `${c.firstName} ${c.lastName}`,
    email: c.email,
    reason,
  });
  const notSelf = excludeId ? { id: { not: excludeId } } : {};

  const byEmail = await prisma.candidateProfile.findFirst({ where: { email: input.email, ...notSelf } });
  const similar = await prisma.candidateProfile.findMany({
    where: {
      ...notSelf,
      OR: [
        ...(input.phone ? [{ phone: input.phone }, { alternatePhone: input.phone }] : []),
        {
          firstName: { equals: input.firstName, mode: "insensitive" as const },
          lastName: { equals: input.lastName, mode: "insensitive" as const },
        },
      ],
    },
    take: 5,
  });
  return {
    emailMatch: byEmail ? toMatch(byEmail, "Same email address") : null,
    similar: similar
      .filter((c) => c.id !== byEmail?.id)
      .map((c) =>
        toMatch(c, input.phone && (c.phone === input.phone || c.alternatePhone === input.phone) ? "Same phone number" : "Same name"),
      ),
  };
}

export type CreateCandidateResult =
  | { status: "created"; id: string; displayId: string }
  | { status: "needs-confirmation"; matches: DuplicateMatch[] };

/** Recruiter creates an internal candidate record (no portal login is created). */
export async function createInternalCandidate(ctx: StaffContext, input: StaffCandidateInput): Promise<CreateCandidateResult> {
  const { emailMatch, similar } = await findPossibleDuplicates(input);
  if (emailMatch) {
    throw new AppError(`A candidate with this email already exists (${emailMatch.displayId} — ${emailMatch.name}).`);
  }
  if (similar.length && !input.confirmNotDuplicate) return { status: "needs-confirmation", matches: similar };

  const docs = await verifyPendingUploads(input.documentIds, ctx.user.id);

  const candidate = await prisma.$transaction(async (tx) => {
    const created = await tx.candidateProfile.create({
      data: {
        ...profileData(input),
        email: input.email,
        source: input.source,
        profileOwnerId: input.profileOwnerId ?? ctx.user.id,
        internalNotes: input.internalNotes ?? null,
        createdById: ctx.user.id,
      },
    });
    await replaceCandidateSkills(tx, created.id, input.primarySkills, input.secondarySkills);
    await activateDocuments(tx, docs, { candidateId: created.id });
    const resume = docs.find((d) => d.type === "RESUME");
    if (resume) await tx.candidateProfile.update({ where: { id: created.id }, data: { defaultResumeId: resume.id } });
    await refreshCandidateSearchVector(created.id, tx);
    return created;
  });
  return { status: "created", id: candidate.id, displayId: candidate.displayId };
}

export async function updateCandidateByStaff(ctx: StaffContext, candidateId: string, input: StaffCandidateInput): Promise<void> {
  const current = await prisma.candidateProfile.findUnique({ where: { id: candidateId } });
  if (!current) throw new AppError("Candidate not found.");
  if (current.userId && input.email !== current.email) {
    throw new AppError("This candidate signs in with their email address. Only the candidate can change it.");
  }
  if (input.email !== current.email) {
    const { emailMatch } = await findPossibleDuplicates(input, candidateId);
    if (emailMatch) throw new AppError(`Another candidate already uses this email (${emailMatch.displayId}).`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.candidateProfile.update({
      where: { id: candidateId },
      data: {
        ...profileData(input),
        email: input.email,
        source: input.source,
        profileOwnerId: input.profileOwnerId ?? null,
        internalNotes: input.internalNotes ?? null,
      },
    });
    await replaceCandidateSkills(tx, candidateId, input.primarySkills, input.secondarySkills);
    await refreshCandidateSearchVector(candidateId, tx);
  });
}
