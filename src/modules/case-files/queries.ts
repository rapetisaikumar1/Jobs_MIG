import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { StaffContext } from "@/modules/access-control/context";
import { jobScopeWhere } from "@/modules/access-control/scope";

/**
 * A job's case file with one folder per application. The folder tree is virtual:
 * Job -> Case File -> Application Folder -> Documents, all driven by relationships.
 */
export async function getCaseFile(ctx: StaffContext, jobDisplayId: string, q?: string) {
  const job = await prisma.job.findFirst({
    where: { AND: [{ displayId: jobDisplayId.toUpperCase() }, jobScopeWhere(ctx)] },
    include: {
      caseFile: { include: { _count: { select: { folders: true } } } },
      skills: { include: { skill: true } },
    },
  });
  if (!job?.caseFile) return null;

  const folderWhere: Prisma.CaseFolderWhereInput = {
    caseFileId: job.caseFile.id,
    ...(q
      ? {
          application: {
            OR: [
              { displayId: { contains: q, mode: "insensitive" } },
              { candidate: { firstName: { contains: q, mode: "insensitive" } } },
              { candidate: { lastName: { contains: q, mode: "insensitive" } } },
              { candidate: { email: { contains: q, mode: "insensitive" } } },
              { candidate: { displayId: { contains: q, mode: "insensitive" } } },
              { candidate: { skills: { some: { skill: { name: { contains: q, mode: "insensitive" } } } } } },
            ],
          },
        }
      : {}),
  };

  const folders = await prisma.caseFolder.findMany({
    where: folderWhere,
    orderBy: { createdAt: "asc" },
    include: {
      application: {
        select: {
          displayId: true,
          status: true,
          source: true,
          appliedAt: true,
          candidate: { select: { displayId: true, firstName: true, lastName: true } },
        },
      },
      _count: { select: { documents: { where: { status: "ACTIVE" } } } },
    },
  });

  return { job, caseFile: job.caseFile, folders };
}

/** All case files the user can access (one per job), newest first. */
export async function listCaseFiles(ctx: StaffContext, q: string | undefined, page: number, pageSize = 48) {
  const where: Prisma.CaseFileWhereInput = {
    job: {
      AND: [
        jobScopeWhere(ctx),
        q
          ? {
              OR: [
                { displayId: { contains: q, mode: "insensitive" } },
                { title: { contains: q, mode: "insensitive" } },
                { caseFile: { displayId: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {},
      ],
    },
  };
  const [total, caseFiles] = await Promise.all([
    prisma.caseFile.count({ where }),
    prisma.caseFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        displayId: true,
        _count: { select: { folders: true } },
        job: { select: { displayId: true, title: true } },
      },
    }),
  ]);
  return { total, caseFiles };
}

/** One application folder (and its documents) inside a job's case file. */
export async function getCaseFolder(ctx: StaffContext, jobDisplayId: string, applicationDisplayId: string) {
  return prisma.caseFolder.findFirst({
    where: {
      application: { displayId: applicationDisplayId.toUpperCase() },
      caseFile: { job: { AND: [{ displayId: jobDisplayId.toUpperCase() }, jobScopeWhere(ctx)] } },
    },
    include: {
      caseFile: { select: { job: { select: { displayId: true, title: true } } } },
      application: {
        select: {
          displayId: true,
          status: true,
          source: true,
          appliedAt: true,
          candidate: { select: { displayId: true, firstName: true, lastName: true } },
        },
      },
      documents: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, fileName: true, sizeBytes: true, mimeType: true, createdAt: true },
      },
    },
  });
}
