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
  return prisma.application.findFirst({
    where: { candidateId, displayId },
    select: {
      id: true,
      displayId: true,
      status: true,
      appliedAt: true,
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
}

// ----- Admin portal -----

export type ApplicationListFilters = {
  q?: string;
  status?: ApplicationStatus;
  source?: Source;
  job?: string;
  mine?: boolean;
};

export async function listApplications(ctx: StaffContext, filters: ApplicationListFilters, page: number) {
  const where: Prisma.ApplicationWhereInput = {
    AND: [
      applicationScopeWhere(ctx),
      filters.status ? { status: filters.status } : {},
      filters.source ? { source: filters.source } : {},
      filters.job ? { job: { displayId: filters.job.toUpperCase() } } : {},
      filters.mine ? { assignedRecruiterId: ctx.user.id } : {},
      filters.q
        ? {
            OR: [
              { displayId: { contains: filters.q, mode: "insensitive" } },
              { candidate: { firstName: { contains: filters.q, mode: "insensitive" } } },
              { candidate: { lastName: { contains: filters.q, mode: "insensitive" } } },
              { candidate: { email: { contains: filters.q, mode: "insensitive" } } },
              { job: { title: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };
  const [total, rows] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      orderBy: { appliedAt: "desc" },
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
