import "server-only";
import type { Country, EmploymentType, JobStatus, Prisma, WorkArrangement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
  const where = publicJobsWhere(filters);
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { displayId: "desc" }],
      select: publicJobSelect,
      ...pageArgs(page, pageSize),
    }),
  ]);
  return { total, jobs };
}

export async function listHomepageJobs() {
  const [featured, recent] = await Promise.all([
    prisma.job.findMany({
      where: { AND: [openJobsWhere(), { isFeatured: true }] },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: publicJobSelect,
    }),
    prisma.job.findMany({ where: openJobsWhere(), orderBy: { publishedAt: "desc" }, take: 6, select: publicJobSelect }),
  ]);
  return { featured, recent };
}

/** Published or closed jobs are viewable publicly; drafts and archived jobs are not. */
export async function getPublicJob(displayId: string) {
  return prisma.job.findFirst({
    where: { displayId: displayId.toUpperCase(), status: { in: ["PUBLISHED", "CLOSED"] } },
    select: publicJobSelect,
  });
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
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
        _count: { select: { applications: true } },
      },
    }),
  ]);
  return { total, jobs };
}

export async function getAdminJob(ctx: StaffContext, displayId: string) {
  return prisma.job.findFirst({
    where: { AND: [{ displayId: displayId.toUpperCase() }, jobScopeWhere(ctx)] },
    include: {
      caseFile: { include: { _count: { select: { folders: true } } } },
      skills: { include: { skill: true } },
      assignedRecruiter: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { applications: true } },
    },
  });
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
