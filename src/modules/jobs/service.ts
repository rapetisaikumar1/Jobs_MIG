import "server-only";
import { openDeadlineCutoff } from "@/lib/format";
import type { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/action-result";
import type { StaffContext } from "@/modules/access-control/context";
import { PERMISSIONS, type Permission } from "@/modules/access-control/permissions";
import { assertJobAccess } from "@/modules/access-control/scope";
import { replaceJobSkills } from "@/modules/candidates/skills";
import type { JobInput } from "@/modules/jobs/schemas";

function jobData(input: JobInput) {
  return {
    title: input.title,
    description: input.description,
    responsibilities: input.responsibilities ?? null,
    minExperience: input.minExperience ?? null,
    maxExperience: input.maxExperience ?? null,
    education: input.education ?? null,
    country: input.country,
    // "state" keeps the first selection so code that reads only the single column still works.
    // Remote jobs: the schema returns no states and no city, so all three are cleared.
    state: input.states[0] ?? null,
    states: input.states,
    city: input.city,
    workArrangement: input.workArrangement,
    employmentType: input.employmentType,
    compensationMin: input.compensationMin ?? null,
    compensationMax: input.compensationMax ?? null,
    currency: input.currency,
    compensationType: input.compensationType,
    salaryPublic: input.salaryPublic,
    applicationDeadline: input.applicationDeadline ?? null,
  };
}

/** A client that is missing or inactive was picked on the job form. */
export class InvalidJobClientError extends AppError {
  constructor() {
    super("Select an active source, or No source.");
    this.name = "InvalidJobClientError";
  }
}

/**
 * The client to save on a job. Undefined leaves the job's client unchanged: staff without the
 * client.view permission never see the field, so whatever they submit is ignored. A new choice
 * must be an existing, active client; keeping the current (possibly inactive) client is allowed.
 */
async function jobClientId(ctx: StaffContext, requested: string | undefined, current: string | null): Promise<string | null | undefined> {
  if (!ctx.can(PERMISSIONS.CLIENT_VIEW)) return undefined;
  const id = requested ?? null;
  if (id === null || id === current) return id;
  const client = await prisma.client.findUnique({ where: { id }, select: { isActive: true } });
  if (!client?.isActive) throw new InvalidJobClientError();
  return id;
}

/**
 * Creates a job in DRAFT status together with its case file, atomically.
 * The database assigns the Job ID and Case File ID from sequences.
 */
export async function createJob(ctx: StaffContext, input: JobInput) {
  const clientId = await jobClientId(ctx, input.clientId, null);
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        ...jobData(input),
        clientId: clientId ?? null,
        status: "DRAFT",
        createdById: ctx.user.id,
        caseFile: { create: {} },
      },
      include: { caseFile: true },
    });
    await replaceJobSkills(tx, job.id, input.requiredSkills, input.preferredSkills);
    return job;
  });
}

/** Updates job details. Never touches status or the original posted date. */
export async function updateJob(ctx: StaffContext, jobId: string, input: JobInput) {
  await assertJobAccess(ctx, jobId);
  const current = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, select: { clientId: true } });
  const clientId = await jobClientId(ctx, input.clientId, current.clientId);
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.update({ where: { id: jobId }, data: { ...jobData(input), clientId } });
    await replaceJobSkills(tx, jobId, input.requiredSkills, input.preferredSkills);
    return job;
  });
}

export type JobStatusAction = "publish" | "close" | "archive" | "reopen" | "unarchive";

const TRANSITIONS: Record<JobStatusAction, { from: JobStatus[]; to: JobStatus; permission: Permission }> = {
  publish: { from: ["DRAFT"], to: "PUBLISHED", permission: PERMISSIONS.JOB_PUBLISH },
  reopen: { from: ["CLOSED"], to: "PUBLISHED", permission: PERMISSIONS.JOB_PUBLISH },
  close: { from: ["PUBLISHED"], to: "CLOSED", permission: PERMISSIONS.JOB_CLOSE },
  archive: { from: ["DRAFT", "CLOSED"], to: "ARCHIVED", permission: PERMISSIONS.JOB_CLOSE },
  unarchive: { from: ["ARCHIVED"], to: "CLOSED", permission: PERMISSIONS.JOB_CLOSE },
};

export function allowedJobActions(status: JobStatus): JobStatusAction[] {
  return (Object.keys(TRANSITIONS) as JobStatusAction[]).filter((a) => TRANSITIONS[a].from.includes(status));
}

/**
 * Status transitions. The first publication sets publishedAt (the public "posted
 * date"); re-opening or editing never resets it.
 */
export async function changeJobStatus(ctx: StaffContext, jobId: string, action: JobStatusAction) {
  const rule = TRANSITIONS[action];
  if (!ctx.can(rule.permission)) throw new ForbiddenError();
  await assertJobAccess(ctx, jobId);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM jobs WHERE id = ${jobId}::uuid FOR UPDATE`; // serialize transitions
    const job = await tx.job.findUniqueOrThrow({ where: { id: jobId } });
    if (!rule.from.includes(job.status)) throw new AppError(`A ${job.status.toLowerCase()} job cannot be changed this way.`);
    const now = new Date();
    if (rule.to === "PUBLISHED" && job.applicationDeadline && job.applicationDeadline < openDeadlineCutoff(now)) {
      throw new AppError("The application deadline has passed. Edit the job and set a future deadline (or clear it) before publishing.");
    }
    const updated = await tx.job.update({
      where: { id: jobId },
      data: {
        status: rule.to,
        publishedAt: rule.to === "PUBLISHED" ? (job.publishedAt ?? now) : undefined,
        closedAt: rule.to === "CLOSED" ? now : rule.to === "PUBLISHED" ? null : undefined,
      },
    });
    return updated;
  });
}
