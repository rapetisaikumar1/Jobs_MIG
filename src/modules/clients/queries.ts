import "server-only";
import type { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, pageArgs } from "@/lib/pagination";
import type { StaffContext } from "@/modules/access-control/context";
import { jobScopeWhere } from "@/modules/access-control/scope";
import type { ClientStatusFilter } from "@/modules/clients/schemas";

export type ClientOption = { id: string; name: string; isActive: boolean };

/**
 * Clients for pickers and filters (job form, jobs / case files / applications filters), by name.
 * Callers must check the "client.view" permission first: client names are internal only and are
 * never shown on the job portal.
 */
export async function listClientOptions(): Promise<ClientOption[]> {
  return prisma.client.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export type ClientFilters = { q?: string; status?: ClientStatusFilter };

/** Job counts per client, limited to the jobs the viewer may see. "Open" means published. */
async function jobCounts(ctx: StaffContext, clientIds: string[]) {
  const counts = new Map<string, { open: number; total: number }>();
  if (!clientIds.length) return counts;
  const rows = await prisma.job.groupBy({
    by: ["clientId", "status"],
    where: { AND: [{ clientId: { in: clientIds } }, jobScopeWhere(ctx)] },
    _count: { _all: true },
  });
  for (const row of rows) {
    if (!row.clientId) continue;
    const entry = counts.get(row.clientId) ?? { open: 0, total: 0 };
    entry.total += row._count._all;
    if (row.status === "PUBLISHED") entry.open += row._count._all;
    counts.set(row.clientId, entry);
  }
  return counts;
}

/** Admin clients list: search by name, contact name or contact email; filter by status. */
export async function listClients(ctx: StaffContext, filters: ClientFilters, page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const and: Prisma.ClientWhereInput[] = [];
  if (filters.q) {
    const q = filters.q.slice(0, 100);
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { contactEmail: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.status) and.push({ isActive: filters.status === "active" });
  const where: Prisma.ClientWhereInput = and.length ? { AND: and } : {};

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, contactName: true, contactEmail: true, isActive: true, updatedAt: true },
      ...pageArgs(page, pageSize),
    }),
  ]);
  const counts = await jobCounts(ctx, clients.map((c) => c.id));
  return { total, clients: clients.map((c) => ({ ...c, jobs: counts.get(c.id) ?? { open: 0, total: 0 } })) };
}

export async function getClient(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: { createdBy: { select: { firstName: true, lastName: true } }, _count: { select: { jobs: true } } },
  });
}

export type ClientJobRow = { id: string; displayId: string; title: string; status: JobStatus; publishedAt: Date | null; createdAt: Date };

/** The client's jobs the viewer may see, newest first. */
export async function listClientJobs(ctx: StaffContext, clientId: string, take = 100): Promise<ClientJobRow[]> {
  return prisma.job.findMany({
    where: { AND: [{ clientId }, jobScopeWhere(ctx)] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, displayId: true, title: true, status: true, publishedAt: true, createdAt: true },
    take,
  });
}
