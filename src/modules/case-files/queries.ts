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
    },
  });
  // Count active documents only for these folders. Prisma's relation _count groups the
  // whole documents table on every call, which grows with total data.
  const docCounts = await prisma.document.groupBy({
    by: ["folderId"],
    where: { folderId: { in: folders.map((f) => f.id) }, status: "ACTIVE" },
    _count: { _all: true },
  });
  const docsByFolder = new Map(docCounts.map((d) => [d.folderId, d._count._all]));

  return {
    job,
    caseFile: job.caseFile,
    folders: folders.map((f) => ({ ...f, _count: { documents: docsByFolder.get(f.id) ?? 0 } })),
  };
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
  const [total, rows] = await Promise.all([
    prisma.caseFile.count({ where }),
    prisma.caseFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        displayId: true,
        job: { select: { displayId: true, title: true } },
      },
    }),
  ]);
  // Folder counts for this page only (relation _count would group all folders).
  const counts = await prisma.caseFolder.groupBy({
    by: ["caseFileId"],
    where: { caseFileId: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const byId = new Map(counts.map((c) => [c.caseFileId, c._count._all]));
  const caseFiles = rows.map((r) => ({ ...r, _count: { folders: byId.get(r.id) ?? 0 } }));
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
