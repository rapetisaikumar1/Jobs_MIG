import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/action-result";
import type { StaffContext } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";

/**
 * Jobs a staff member may work on. Users without "job.view_all" see jobs they
 * created and jobs assigned to them.
 */
export function jobScopeWhere(ctx: StaffContext): Prisma.JobWhereInput {
  if (ctx.can(PERMISSIONS.JOB_VIEW_ALL)) return {};
  return { OR: [{ assignedRecruiterId: ctx.user.id }, { createdById: ctx.user.id }] };
}

/** Applications on in-scope jobs, plus applications assigned directly to the user. */
export function applicationScopeWhere(ctx: StaffContext): Prisma.ApplicationWhereInput {
  if (ctx.can(PERMISSIONS.JOB_VIEW_ALL)) return {};
  return { OR: [{ job: jobScopeWhere(ctx) }, { assignedRecruiterId: ctx.user.id }] };
}

export async function canAccessJob(ctx: StaffContext, jobId: string): Promise<boolean> {
  const count = await prisma.job.count({ where: { AND: [{ id: jobId }, jobScopeWhere(ctx)] } });
  return count > 0;
}

export async function assertJobAccess(ctx: StaffContext, jobId: string): Promise<void> {
  if (!(await canAccessJob(ctx, jobId))) throw new ForbiddenError("You do not have access to this job.");
}

export async function assertApplicationAccess(ctx: StaffContext, applicationId: string): Promise<void> {
  const count = await prisma.application.count({
    where: { AND: [{ id: applicationId }, applicationScopeWhere(ctx)] },
  });
  if (!count) throw new ForbiddenError("You do not have access to this application.");
}
