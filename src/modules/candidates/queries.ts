import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pageArgs } from "@/lib/pagination";
import type { StaffContext } from "@/modules/access-control/context";
import { applicationScopeWhere } from "@/modules/access-control/scope";

export const candidateListSelect = {
  id: true,
  displayId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  country: true,
  source: true,
  currentTitle: true,
  professionalTitle: true,
  totalExperienceYears: true,
  defaultResumeId: true,
  updatedAt: true,
  skills: { select: { level: true, skill: { select: { name: true } } } },
} satisfies Prisma.CandidateProfileSelect;

/** Quick lookup by name, email, phone or Candidate ID. */
export function quickCandidateWhere(q?: string): Prisma.CandidateProfileWhereInput {
  if (!q) return {};
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 4);
  const digits = q.replace(/\D/g, "");
  return {
    OR: [
      { displayId: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      {
        AND: tokens.map((t) => ({
          OR: [{ firstName: { contains: t, mode: "insensitive" as const } }, { lastName: { contains: t, mode: "insensitive" as const } }],
        })),
      },
    ],
  };
}

/** Candidates added by staff (internal recruitment, referrals, other) — not job portal sign-ups. */
export const INTERNAL_CANDIDATES: Prisma.CandidateProfileWhereInput = { source: { not: "JOB_PORTAL" } };

export async function listInternalCandidates(q: string | undefined, page: number) {
  const where: Prisma.CandidateProfileWhereInput = { AND: [INTERNAL_CANDIDATES, quickCandidateWhere(q)] };
  const [total, candidates] = await Promise.all([
    prisma.candidateProfile.count({ where }),
    prisma.candidateProfile.findMany({ where, orderBy: { updatedAt: "desc" }, ...pageArgs(page), select: candidateListSelect }),
  ]);
  return { total, candidates };
}

export async function getCandidateForStaff(ctx: StaffContext, displayId: string) {
  return prisma.candidateProfile.findUnique({
    where: { displayId: displayId.toUpperCase() },
    include: {
      skills: { include: { skill: true } },
      profileOwner: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      user: { select: { id: true, isActive: true } },
      documents: {
        where: { status: "ACTIVE", applicationId: null },
        orderBy: { createdAt: "desc" },
      },
      applications: {
        where: applicationScopeWhere(ctx),
        orderBy: { appliedAt: "desc" },
        select: {
          id: true,
          displayId: true,
          status: true,
          source: true,
          appliedAt: true,
          job: { select: { displayId: true, title: true } },
        },
      },
    },
  });
}

export async function getOwnProfile(candidateId: string) {
  return prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      skills: { include: { skill: true } },
      documents: { where: { status: "ACTIVE", applicationId: null }, orderBy: { createdAt: "desc" } },
    },
  });
}
