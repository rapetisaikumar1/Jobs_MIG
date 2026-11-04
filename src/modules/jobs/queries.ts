import "server-only";
import { cache } from "react";
import type { Country, EmploymentType, JobStatus, Prisma, WorkArrangement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/ttl-cache";

/** Public job data is the same for every visitor: cache briefly, invalidated on job changes. */
export const PUBLIC_JOBS_CACHE = "public-jobs:";
const PUBLIC_TTL_MS = 30_000;
import { openDeadlineCutoff, skillSlug } from "@/lib/format";
import { pageArgs } from "@/lib/pagination";
import { CA_PROVINCES, US_STATES } from "@/config/locations";
import type { StaffContext } from "@/modules/access-control/context";
import { jobScopeWhere } from "@/modules/access-control/scope";

// ----- Public portal -----

/** Fields safe for the public portal: no internal notes or recruiter details. */
export const publicJobSelect = {
  id: true,
  displayId: true,
  title: true,
  description: true,
  responsibilities: true,
  minExperience: true,
  maxExperience: true,
  education: true,
  country: true,
  state: true,
  city: true,
  workArrangement: true,
  employmentType: true,
  compensationMin: true,
  compensationMax: true,
  currency: true,
  compensationType: true,
  salaryPublic: true,
  applicationDeadline: true,
  isFeatured: true,
  status: true,
  publishedAt: true,
  skills: { select: { type: true, skill: { select: { name: true } } } },
} satisfies Prisma.JobSelect;

export type PublicJob = Prisma.JobGetPayload<{ select: typeof publicJobSelect }>;

/** What a job card shows: the public fields minus the long texts (description, responsibilities, education). */
const publicJobCardSelect = (({ description, responsibilities, education, ...rest }) => {
  void description; void responsibilities; void education;
  return rest;
})(publicJobSelect);
export type PublicJobCard = Prisma.JobGetPayload<{ select: typeof publicJobCardSelect }>;

/** Never send a hidden salary to the public portal (it would otherwise be serialized into the page payload). */
export function redactHiddenSalary<T extends Pick<PublicJob, "salaryPublic" | "compensationMin" | "compensationMax">>(job: T): T {
  return job.salaryPublic ? job : { ...job, compensationMin: null, compensationMax: null };
}

/** Open for applications: published and the deadline (if any) has not passed. */
export function openJobsWhere(now = new Date()): Prisma.JobWhereInput {
  return {
    status: "PUBLISHED",
    OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: openDeadlineCutoff(now) } }],
  };
}

export type PublicJobFilters = {
  q?: string;
  location?: string;
  country?: Country;
  workArrangement?: WorkArrangement;
  employmentType?: EmploymentType;
  skills?: string[];
};

function locationWhere(location: string): Prisma.JobWhereInput {
  const lower = location.toLowerCase();
  const regionCodes = [...US_STATES, ...CA_PROVINCES]
    .filter((r) => r.name.toLowerCase().includes(lower) || r.code.toLowerCase() === lower)
    .map((r) => r.code);
  return {
    OR: [{ city: { contains: location, mode: "insensitive" } }, ...(regionCodes.length ? [{ state: { in: regionCodes } }] : [])],
  };
}

export function publicJobsWhere(filters: PublicJobFilters): Prisma.JobWhereInput {
  return {
    AND: [
      openJobsWhere(),
      filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { skills: { some: { skill: { name: { contains: filters.q, mode: "insensitive" } } } } },
            ],
          }
        : {},
      filters.location ? locationWhere(filters.location) : {},
      filters.country ? { country: filters.country } : {},
      filters.workArrangement ? { workArrangement: filters.workArrangement } : {},
      filters.employmentType ? { employmentType: filters.employmentType } : {},
      ...(filters.skills ?? []).map((s) => ({ skills: { some: { skill: { slug: skillSlug(s) } } } })),
    ],
  };
}

export async function listPublicJobs(filters: PublicJobFilters, page: number, pageSize = 15) {
  return cached(`${PUBLIC_JOBS_CACHE}list:${JSON.stringify([filters, page, pageSize])}`, PUBLIC_TTL_MS, () => loadPublicJobs(filters, page, pageSize));
}

async function loadPublicJobs(filters: PublicJobFilters, page: number, pageSize: number) {
  const where = publicJobsWhere(filters);
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { displayId: "desc" }],
      select: publicJobCardSelect,
      ...pageArgs(page, pageSize),
    }),
  ]);
  return { total, jobs: jobs.map(redactHiddenSalary) };
}

export async function listHomepageJobs() {
  return cached(`${PUBLIC_JOBS_CACHE}home`, PUBLIC_TTL_MS, loadHomepageJobs);
}

async function loadHomepageJobs() {
  const [featured, recent] = await Promise.all([
    prisma.job.findMany({
      where: { AND: [openJobsWhere(), { isFeatured: true }] },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: publicJobCardSelect,
    }),
    prisma.job.findMany({ where: openJobsWhere(), orderBy: { publishedAt: "desc" }, take: 6, select: publicJobCardSelect }),
  ]);
  return { featured: featured.map(redactHiddenSalary), recent: recent.map(redactHiddenSalary) };
}

/** Count of jobs open for applications (homepage headline). */
export async function countOpenJobs() {
  return cached(`${PUBLIC_JOBS_CACHE}count`, PUBLIC_TTL_MS, () => prisma.job.count({ where: openJobsWhere() }));
}

/** Search-as-you-type: only what the suggestion list shows. */
export async function suggestPublicJobs(filters: PublicJobFilters, take = 6) {
  return cached(`${PUBLIC_JOBS_CACHE}suggest:${JSON.stringify([filters, take])}`, PUBLIC_TTL_MS, () => loadSuggestions(filters, take));
}

async function loadSuggestions(filters: PublicJobFilters, take: number) {
  const where = publicJobsWhere(filters);
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { displayId: "desc" }],
      take,
      select: { displayId: true, title: true, city: true, state: true, country: true, workArrangement: true, employmentType: true },
    }),
  ]);
  return { total, jobs };
}

/**
 * Published or closed jobs are viewable publicly; drafts and archived jobs are not.
 * cache(): generateMetadata and the page both call this in the same request.
 */
export const getPublicJob = cache(async (displayId: string) =>
  cached(`${PUBLIC_JOBS_CACHE}job:${displayId.toUpperCase()}`, PUBLIC_TTL_MS, () => loadPublicJob(displayId)),
);

async function loadPublicJob(displayId: string) {
  const job = await prisma.job.findFirst({
    where: { displayId: displayId.toUpperCase(), status: { in: ["PUBLISHED", "CLOSED"] } },
    select: publicJobSelect,
  });
  return job && redactHiddenSalary(job);
}

export async function listSkillSuggestions(limit = 300) {
  const skills = await prisma.skill.findMany({ orderBy: { name: "asc" }, take: limit, select: { name: true } });
  return skills.map((s) => s.name);
}

// ----- Admin portal -----

export type AdminJobFilters = { q?: string; status?: JobStatus; mine?: boolean };

export async function listAdminJobs(ctx: StaffContext, filters: AdminJobFilters, page: number) {
  const where: Prisma.JobWhereInput = {
    AND: [
      jobScopeWhere(ctx),
      filters.status ? { status: filters.status } : {},
      filters.mine ? { assignedRecruiterId: ctx.user.id } : {},
      filters.q
        ? {
            OR: [
              { displayId: { contains: filters.q, mode: "insensitive" } },
              { title: { contains: filters.q, mode: "insensitive" } },
              { city: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const [total, rows] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
      select: {
        id: true,
        displayId: true,
        title: true,
        status: true,
        city: true,
        state: true,
        country: true,
        createdAt: true,
        publishedAt: true,
        caseFile: { select: { displayId: true } },
        assignedRecruiter: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  // Application counts for this page only (relation _count would group all applications).
  const counts = await prisma.application.groupBy({
    by: ["jobId"],
    where: { jobId: { in: rows.map((j) => j.id) } },
    _count: { _all: true },
  });
  const byJob = new Map(counts.map((c) => [c.jobId, c._count._all]));
  const jobs = rows.map((j) => ({ ...j, _count: { applications: byJob.get(j.id) ?? 0 } }));
  return { total, jobs };
}

export async function getAdminJob(ctx: StaffContext, displayId: string) {
  const job = await prisma.job.findFirst({
    where: { AND: [{ displayId: displayId.toUpperCase() }, jobScopeWhere(ctx)] },
    include: {
      caseFile: true,
      skills: { include: { skill: true } },
      assignedRecruiter: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!job) return null;
  // Counted per job: a relation _count here groups the whole applications/folders tables.
  const [applications, folders] = await Promise.all([
    prisma.application.count({ where: { jobId: job.id } }),
    job.caseFile ? prisma.caseFolder.count({ where: { caseFileId: job.caseFile.id } }) : 0,
  ]);
  return {
    ...job,
    caseFile: job.caseFile ? { ...job.caseFile, _count: { folders } } : null,
    _count: { applications },
  };
}

export async function listJobFormOptions() {
  const [staff] = await Promise.all([
    prisma.user.findMany({
      where: { type: "STAFF", isActive: true },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  return { staff };
}
