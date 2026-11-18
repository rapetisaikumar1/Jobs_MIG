import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { StaffContext } from "@/modules/access-control/context";
import { jobScopeWhere } from "@/modules/access-control/scope";
import { clientFilterWhere, jobClientSelect, visibleClient, type ClientFilter } from "@/modules/jobs/queries";

/** Application folders shown per page inside one case file. */
export const CASE_FOLDER_PAGE_SIZE = 50;

const personName = { select: { firstName: true, lastName: true } } as const;

/**
 * A job's case file with one folder per application. The folder tree is virtual:
 * Job -> Case File -> Application Folder -> Documents, all driven by relationships.
 */
export async function getCaseFile(
  ctx: StaffContext,
  jobDisplayId: string,
  q: string | undefined,
  page = 1,
  pageSize = CASE_FOLDER_PAGE_SIZE,
) {
  const found = await prisma.job.findFirst({
    where: { AND: [{ displayId: jobDisplayId.toUpperCase() }, jobScopeWhere(ctx)] },
    select: {
      displayId: true,
      title: true,
      status: true,
      createdAt: true,
      createdBy: personName,
      client: jobClientSelect,
      caseFile: { select: { id: true, displayId: true, createdAt: true } },
    },
  });
  if (!found?.caseFile) return null;

  const folderWhere: Prisma.CaseFolderWhereInput = {
    caseFileId: found.caseFile.id,
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

  // Counted for this case file only (relation _count would group every folder).
  const [folderTotal, matching, folders] = await Promise.all([
    prisma.caseFolder.count({ where: { caseFileId: found.caseFile.id } }),
    q ? prisma.caseFolder.count({ where: folderWhere }) : null,
    prisma.caseFolder.findMany({
      where: folderWhere,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        displayId: true,
        createdAt: true,
        application: {
          select: {
            displayId: true,
            status: true,
            source: true,
            appliedAt: true,
            updatedAt: true,
            candidate: { select: { displayId: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);
  // Count active documents only for these folders. Prisma's relation _count groups the
  // whole documents table on every call, which grows with total data.
  const docCounts = folders.length
    ? await prisma.document.groupBy({
        by: ["folderId"],
        where: { folderId: { in: folders.map((f) => f.id) }, status: "ACTIVE" },
        _count: { _all: true },
      })
    : [];
  const docsByFolder = new Map(docCounts.map((d) => [d.folderId, d._count._all]));

  const caseFile = { ...found.caseFile, _count: { folders: folderTotal } };
  return {
    job: { ...found, client: visibleClient(ctx, found.client), caseFile },
    caseFile,
    /** Folders matching the search (all folders when there is no search). */
    total: matching ?? folderTotal,
    folders: folders.map((f) => ({ ...f, _count: { documents: docsByFolder.get(f.id) ?? 0 } })),
  };
}

export type CaseFileListFilters = { q?: string; client?: ClientFilter };

/** All case files the user can access (one per job), newest first. The client comes from the job. */
export async function listCaseFiles(ctx: StaffContext, filters: CaseFileListFilters, page: number, pageSize = 48) {
  const { q } = filters;
  const where: Prisma.CaseFileWhereInput = {
    job: {
      AND: [
        jobScopeWhere(ctx),
        clientFilterWhere(ctx, filters.client),
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        displayId: true,
        createdAt: true,
        job: { select: { displayId: true, title: true, status: true, updatedAt: true, createdBy: personName, client: jobClientSelect } },
      },
    }),
  ]);
  // Folder counts and newest folder for this page only (relation _count would group all folders).
  const counts = rows.length
    ? await prisma.caseFolder.groupBy({
        by: ["caseFileId"],
        where: { caseFileId: { in: rows.map((r) => r.id) } },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const byId = new Map(counts.map((c) => [c.caseFileId, c]));
  const caseFiles = rows.map((r) => {
    const stats = byId.get(r.id);
    const newestFolder = stats?._max.createdAt;
    // Last activity: the newest application folder, or the last edit to the job, whichever is later.
    const lastActivityAt = newestFolder && newestFolder > r.job.updatedAt ? newestFolder : r.job.updatedAt;
    return { ...r, job: { ...r.job, client: visibleClient(ctx, r.job.client) }, lastActivityAt, _count: { folders: stats?._count._all ?? 0 } };
  });
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
      caseFile: { select: { displayId: true, job: { select: { displayId: true, title: true } } } },
      application: {
        select: {
          displayId: true,
          status: true,
          source: true,
          appliedAt: true,
          updatedAt: true,
          candidate: { select: { displayId: true, firstName: true, lastName: true } },
        },
      },
      documents: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          fileName: true,
          sizeBytes: true,
          mimeType: true,
          createdAt: true,
          uploadedBy: personName,
        },
      },
    },
  });
}
