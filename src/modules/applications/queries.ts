import "server-only";
import type { ApplicationStatus, Prisma, Source } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pageArgs } from "@/lib/pagination";
import type { StaffContext } from "@/modules/access-control/context";
import { applicationScopeWhere } from "@/modules/access-control/scope";

// ----- Candidate portal (never exposes internal notes or status history) -----

export async function listOwnApplications(candidateId: string) {
  return prisma.application.findMany({
    where: { candidateId },
    orderBy: { appliedAt: "desc" },
    select: {
      id: true,
      displayId: true,
      status: true,
      appliedAt: true,
      job: { select: { displayId: true, title: true, status: true, city: true, state: true, country: true } },
    },
  });
}

export async function getOwnApplication(candidateId: string, displayId: string) {
  const app = await prisma.application.findFirst({
    where: { candidateId, displayId },
    select: {
      id: true,
      displayId: true,
      status: true,
      appliedAt: true,
      source: true,
      relevantExperienceYears: true,
      relevantExperienceSummary: true,
      availability: true,
      workAuthorizationResponse: true,
      additionalComments: true,
      job: {
        select: {
          displayId: true,
          title: true,
          status: true,
          city: true,
          state: true,
          country: true,
          workArrangement: true,
          employmentType: true,
        },
      },
      documents: {
        where: { status: "ACTIVE" },
        select: { id: true, type: true, fileName: true, sizeBytes: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!app) return null;
  const { source, ...rest } = app;
  if (source === "JOB_PORTAL") return rest;
  // Applications a recruiter created: these answers were written by staff (e.g. "Why this
  // candidate fits"), not by the candidate, so they are not shown in the candidate portal.
  return { ...rest, relevantExperienceYears: null, relevantExperienceSummary: null, availability: null, workAuthorizationResponse: null, additionalComments: null };
}

// ----- Admin portal -----

export type ApplicationListFilters = {
  q?: string;
  status?: ApplicationStatus;
  source?: Source;
  job?: string;
  mine?: boolean;
};

const KEYWORD_ID_LIMIT = 5_000;

/**
 * Keyword filter for the admin applications list. An OR across joined tables
 * cannot use indexes, so matching candidate and job IDs are looked up first
 * (trigram-indexed) and the application filter becomes indexed IN lists.
 * Falls back to the plain relation filter when a keyword matches too many rows.
 */
async function applicationKeywordWhere(q: string): Promise<Prisma.ApplicationWhereInput> {
  const contains = { contains: q, mode: "insensitive" } as const;
  // "Jane Smith": every word must match the first or last name (as in the Candidates list).
  const words = q.split(/\s+/).filter(Boolean);
  const fullName: Prisma.CandidateProfileWhereInput[] =
    words.length > 1
      ? [{ AND: words.map((w) => ({ OR: [{ firstName: { contains: w, mode: "insensitive" as const } }, { lastName: { contains: w, mode: "insensitive" as const } }] })) }]
      : [];
  const [candidates, jobs] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, ...fullName] },
      select: { id: true },
      take: KEYWORD_ID_LIMIT + 1,
    }),
    prisma.job.findMany({ where: { title: contains }, select: { id: true }, take: KEYWORD_ID_LIMIT + 1 }),
  ]);
  if (candidates.length > KEYWORD_ID_LIMIT || jobs.length > KEYWORD_ID_LIMIT) {
    return {
      OR: [
        { displayId: contains },
        { candidate: { firstName: contains } },
        { candidate: { lastName: contains } },
        { candidate: { email: contains } },
        ...fullName.map((f) => ({ candidate: f })),
        { job: { title: contains } },
      ],
    };
  }
  return {
    OR: [
      { displayId: contains },
      ...(candidates.length ? [{ candidateId: { in: candidates.map((c) => c.id) } }] : []),
      ...(jobs.length ? [{ jobId: { in: jobs.map((j) => j.id) } }] : []),
    ],
  };
}

export async function listApplications(ctx: StaffContext, filters: ApplicationListFilters, page: number) {
  const where: Prisma.ApplicationWhereInput = {
    AND: [
      applicationScopeWhere(ctx),
      filters.status ? { status: filters.status } : {},
      filters.source ? { source: filters.source } : {},
      filters.job ? { job: { displayId: filters.job.toUpperCase() } } : {},
      filters.mine ? { assignedRecruiterId: ctx.user.id } : {},
      filters.q ? await applicationKeywordWhere(filters.q) : {},
    ],
  };
  const [total, rows] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
      select: {
        id: true,
        displayId: true,
        status: true,
        source: true,
        appliedAt: true,
        candidate: { select: { displayId: true, firstName: true, lastName: true } },
        job: { select: { displayId: true, title: true, caseFile: { select: { displayId: true } } } },
        folder: { select: { displayId: true } },
        assignedRecruiter: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  return { total, rows };
}

/** Everything in one application folder. Caller must already have checked permissions. */
export async function getApplicationFolder(ctx: StaffContext, displayId: string) {
  return prisma.application.findFirst({
    where: { AND: [{ displayId }, applicationScopeWhere(ctx)] },
    include: {
      candidate: { include: { skills: { include: { skill: true } } } },
      job: { include: { caseFile: true } },
      folder: true,
      documents: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
      statusHistory: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { firstName: true, lastName: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { firstName: true, lastName: true } } } },
      assignedRecruiter: { select: { id: true, firstName: true, lastName: true } },
      consentRecordedBy: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function listActiveStaff() {
  return prisma.user.findMany({
    where: { type: "STAFF", isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
}
