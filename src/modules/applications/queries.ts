import "server-only";
import type { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pageArgs } from "@/lib/pagination";
import type { StaffContext } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { applicationScopeWhere } from "@/modules/access-control/scope";
import { clientFilterWhere, jobClientSelect, visibleClient, type ClientFilter } from "@/modules/jobs/queries";

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
      job: { select: { displayId: true, title: true, status: true, city: true, state: true, states: true, country: true, workArrangement: true, employmentType: true } },
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
          states: true,
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
  job?: string;
  /** A client's id or "none"; ignored for staff who cannot view clients. */
  client?: ClientFilter;
};

const KEYWORD_ID_LIMIT = 5_000;

/**
 * Keyword filter for the admin applications list. An OR across joined tables
 * cannot use indexes, so matching candidate and job IDs are looked up first
 * (trigram-indexed) and the application filter becomes indexed IN lists.
 * Falls back to the plain relation filter when a keyword matches too many rows.
 */
async function applicationKeywordWhere(ctx: StaffContext, q: string): Promise<Prisma.ApplicationWhereInput> {
  const contains = { contains: q, mode: "insensitive" } as const;
  // The job's client name is searched too, but only for staff who may view clients.
  const jobMatch: Prisma.JobWhereInput = ctx.can(PERMISSIONS.CLIENT_VIEW)
    ? { OR: [{ title: contains }, { client: { name: contains } }] }
    : { title: contains };
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
    prisma.job.findMany({ where: jobMatch, select: { id: true }, take: KEYWORD_ID_LIMIT + 1 }),
  ]);
  if (candidates.length > KEYWORD_ID_LIMIT || jobs.length > KEYWORD_ID_LIMIT) {
    return {
      OR: [
        { displayId: contains },
        { candidate: { firstName: contains } },
        { candidate: { lastName: contains } },
        { candidate: { email: contains } },
        ...fullName.map((f) => ({ candidate: f })),
        { job: jobMatch },
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
      filters.job ? { job: { displayId: filters.job.toUpperCase() } } : {},
      filters.client ? { job: clientFilterWhere(ctx, filters.client) } : {},
      filters.q ? await applicationKeywordWhere(ctx, filters.q) : {},
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
        appliedAt: true,
        candidate: { select: { displayId: true, firstName: true, lastName: true } },
        job: { select: { displayId: true, title: true, caseFile: { select: { displayId: true } }, client: jobClientSelect } },
        folder: { select: { displayId: true } },
      },
    }),
  ]);
  return { total, rows: rows.map((r) => ({ ...r, job: { ...r.job, client: visibleClient(ctx, r.job.client) } })) };
}

/** Everything in one application folder. Caller must already have checked permissions. */
export async function getApplicationFolder(ctx: StaffContext, displayId: string) {
  const app = await prisma.application.findFirst({
    where: { AND: [{ displayId }, applicationScopeWhere(ctx)] },
    include: {
      candidate: { include: { skills: { include: { skill: true } } } },
      job: { include: { caseFile: true, client: jobClientSelect } },
      folder: true,
      documents: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
      statusHistory: { orderBy: { changedAt: "desc" }, include: { changedBy: { select: { firstName: true, lastName: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { firstName: true, lastName: true } } } },
      consentRecordedBy: { select: { firstName: true, lastName: true } },
    },
  });
  // The job's client is internal: only for staff who may view clients.
  return app && { ...app, job: { ...app.job, client: visibleClient(ctx, app.job.client) } };
}
