import "server-only";
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
    state: input.state,
    city: input.city,
    workArrangement: input.workArrangement,
    employmentType: input.employmentType,
    compensationMin: input.compensationMin ?? null,
    compensationMax: input.compensationMax ?? null,
    currency: input.currency,
    compensationType: input.compensationType,
    salaryPublic: input.salaryPublic,
    applicationDeadline: input.applicationDeadline ?? null,
    assignedRecruiterId: input.assignedRecruiterId ?? null,
    internalNotes: input.internalNotes ?? null,
    isFeatured: input.isFeatured,
  };
}

async function validateReferences(input: JobInput) {
  if (input.assignedRecruiterId) {
    const recruiter = await prisma.user.findFirst({ where: { id: input.assignedRecruiterId, type: "STAFF", isActive: true } });
    if (!recruiter) throw new AppError("Select an active staff member as the assigned recruiter.");
  }
}

/**
 * Creates a job in DRAFT status together with its case file, atomically.
 * The database assigns the Job ID and Case File ID from sequences.
 */
export async function createJob(ctx: StaffContext, input: JobInput) {
  await validateReferences(input);

  return prisma.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        ...jobData(input),
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
  await validateReferences(input);
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.update({ where: { id: jobId }, data: jobData(input) });
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
    const job = await tx.job.findUniqueOrThrow({ where: { id: jobId } });
    if (!rule.from.includes(job.status)) throw new AppError(`A ${job.status.toLowerCase()} job cannot be changed this way.`);
    const now = new Date();
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
