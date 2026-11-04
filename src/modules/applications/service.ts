import "server-only";
import { Prisma, type ApplicationStatus, type Document } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action-result";
import { isDeadlinePassed } from "@/lib/format";
import type { StaffContext } from "@/modules/access-control/context";
import { assertApplicationAccess, assertJobAccess } from "@/modules/access-control/scope";
import type { CandidateContext } from "@/modules/auth/session";
import { buildCandidateSnapshot } from "@/modules/candidates/snapshot";
import { activateDocuments, stageDocumentCopy, verifyPendingUploads } from "@/modules/documents/service";
import type { AddCandidateToJobInput, ApplyInput } from "@/modules/applications/schemas";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function loadProfileForSnapshot(candidateId: string) {
  return prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: { skills: { include: { skill: true } }, defaultResume: true },
  });
}

/**
 * Candidate applies on the job portal. In one transaction this creates the
 * application (with its candidate snapshot), the application folder inside the
 * job's case file, the initial status history entry, and activates the documents.
 */
export async function submitPortalApplication(ctx: NonNullable<CandidateContext>, input: ApplyInput) {
  const job = await prisma.job.findUnique({ where: { id: input.jobId }, include: { caseFile: true } });
  if (!job || job.status !== "PUBLISHED" || isDeadlinePassed(job.applicationDeadline)) {
    throw new AppError("This job is no longer accepting applications.");
  }
  if (!job.caseFile) throw new Error(`Job ${job.displayId} has no case file`);

  const candidateId = ctx.profile.id;
  const existing = await prisma.application.findUnique({ where: { candidateId_jobId: { candidateId, jobId: job.id } } });
  if (existing) throw new AppError("You have already applied for this job.");

  const profile = await loadProfileForSnapshot(candidateId);
  if (!profile.phone) throw new AppError("Please add a phone number to your profile before applying.");

  // Stage the application's own copy of each document (storage work happens outside the transaction).
  let resume: Document;
  let profileResumeCopy: Document | null = null;
  if (input.resumeChoice === "profile") {
    if (!profile.defaultResume || profile.defaultResume.status !== "ACTIVE") {
      throw new AppError("Upload a resume or add a default resume to your profile.");
    }
    resume = await stageDocumentCopy(profile.defaultResume, ctx.user.id);
  } else {
    [resume] = await verifyPendingUploads([input.resumeDocumentId!], ctx.user.id, { [input.resumeDocumentId!]: "RESUME" });
    if (input.saveAsDefaultResume) profileResumeCopy = await stageDocumentCopy(resume, ctx.user.id);
  }

  const extraIds = [input.coverLetterDocumentId, ...input.supportingDocumentIds].filter((id): id is string => !!id);
  const expected = Object.fromEntries([
    ...(input.coverLetterDocumentId ? [[input.coverLetterDocumentId, "COVER_LETTER" as const]] : []),
    ...input.supportingDocumentIds.map((id) => [id, "SUPPORTING" as const]),
  ]);
  const extras = await verifyPendingUploads(extraIds, ctx.user.id, expected);
  const snapshot = buildCandidateSnapshot(profile, resume);

  try {
    return await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          candidateId,
          jobId: job.id,
          source: "JOB_PORTAL",
          status: "APPLIED",
          relevantExperienceYears: input.relevantExperienceYears ?? null,
          relevantExperienceSummary: input.relevantExperienceSummary ?? null,
          availability: input.availability,
          workAuthorizationResponse: input.workAuthorizationResponse ?? null,
          additionalComments: input.additionalComments ?? null,
          assignedRecruiterId: job.assignedRecruiterId,
          candidateSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          folder: { create: { caseFileId: job.caseFile!.id } },
          statusHistory: { create: { toStatus: "APPLIED", note: "Submitted on the job portal" } },
        },
        include: { folder: true },
      });
      await activateDocuments(tx, [resume, ...extras], {
        candidateId,
        applicationId: application.id,
        folderId: application.folder!.id,
      });
      if (profileResumeCopy) {
        await activateDocuments(tx, [profileResumeCopy], { candidateId });
        await tx.candidateProfile.update({ where: { id: candidateId }, data: { defaultResumeId: profileResumeCopy.id } });
      }
      return { id: application.id, displayId: application.displayId, jobDisplayId: job.displayId };
    });
  } catch (error) {
    // Concurrent double-submit: the unique (candidate, job) constraint wins. Staged copies are cleaned up by cron.
    if (isUniqueViolation(error)) throw new AppError("You have already applied for this job.");
    throw error;
  }
}

/** Recruiter adds an existing (internal or portal) candidate to a job's case file. */
export async function addCandidateToJob(ctx: StaffContext, input: AddCandidateToJobInput) {
  await assertJobAccess(ctx, input.jobId);
  const job = await prisma.job.findUnique({ where: { id: input.jobId }, include: { caseFile: true } });
  if (!job || !job.caseFile) throw new AppError("Job not found.");
  if (job.status === "CLOSED" || job.status === "ARCHIVED") {
    throw new AppError("Candidates can only be added to draft or open jobs.");
  }

  const existing = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId: input.candidateId, jobId: job.id } },
  });
  if (existing) throw new AppError(`This candidate already has an application for this job (${existing.displayId}).`);

  const profile = await loadProfileForSnapshot(input.candidateId);

  const selected = await prisma.document.findUnique({ where: { id: input.resumeDocumentId } });
  let resume: Document;
  let profileResumeCopy: Document | null = null;
  if (
    selected?.status === "ACTIVE" &&
    selected.type === "RESUME" &&
    selected.candidateId === profile.id &&
    !selected.applicationId
  ) {
    resume = await stageDocumentCopy(selected, ctx.user.id);
  } else if (selected?.status === "PENDING" && (!selected.candidateId || selected.candidateId === profile.id)) {
    [resume] = await verifyPendingUploads([selected.id], ctx.user.id, { [selected.id]: "RESUME" });
    if (!profile.defaultResumeId) profileResumeCopy = await stageDocumentCopy(resume, ctx.user.id);
  } else {
    throw new AppError("Select a valid resume for this candidate.");
  }

  const snapshot = buildCandidateSnapshot(profile, resume);
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          candidateId: profile.id,
          jobId: job.id,
          source: "INTERNAL_RECRUITMENT",
          status: "APPLIED",
          relevantExperienceYears: input.relevantExperienceYears ?? profile.relevantExperienceYears,
          relevantExperienceSummary: input.relevantExperienceSummary ?? null,
          availability: input.availability ?? null,
          workAuthorizationResponse: input.workAuthorizationResponse ?? null,
          assignedRecruiterId: input.assignedRecruiterId ?? job.assignedRecruiterId ?? ctx.user.id,
          consentBasis: input.consentBasis,
          consentRecordedAt: now,
          consentRecordedById: ctx.user.id,
          candidateSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          folder: { create: { caseFileId: job.caseFile!.id } },
          statusHistory: { create: { toStatus: "APPLIED", changedById: ctx.user.id, note: "Added to job by recruiter" } },
          notes: input.note ? { create: { authorId: ctx.user.id, body: input.note } } : undefined,
        },
        include: { folder: true },
      });
      await activateDocuments(tx, [resume], {
        candidateId: profile.id,
        applicationId: application.id,
        folderId: application.folder!.id,
      });
      if (profileResumeCopy) {
        await activateDocuments(tx, [profileResumeCopy], { candidateId: profile.id });
        await tx.candidateProfile.update({ where: { id: profile.id }, data: { defaultResumeId: profileResumeCopy.id } });
      }
      return { id: application.id, displayId: application.displayId };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("This candidate already has an application for this job.");
    throw error;
  }
}

export async function updateApplicationStatus(
  ctx: StaffContext,
  input: { applicationId: string; status: ApplicationStatus; note?: string },
) {
  await assertApplicationAccess(ctx, input.applicationId);
  await prisma.$transaction(async (tx) => {
    // Row lock: concurrent changes are serialized so each history row's fromStatus is the
    // status it actually replaced (without it, simultaneous updates recorded stale fromStatus).
    await tx.$executeRaw`SELECT 1 FROM applications WHERE id = ${input.applicationId}::uuid FOR UPDATE`;
    const current = await tx.application.findUniqueOrThrow({ where: { id: input.applicationId } });
    if (current.status === input.status) throw new AppError("The application already has this status.");
    await tx.application.update({ where: { id: current.id }, data: { status: input.status } });
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: current.id,
        fromStatus: current.status,
        toStatus: input.status,
        changedById: ctx.user.id,
        note: input.note ?? null,
        // Taken after the lock; the column default (transaction start) can order rows wrongly.
        changedAt: new Date(),
      },
    });
  });
}

export async function addApplicationNote(ctx: StaffContext, applicationId: string, body: string) {
  await assertApplicationAccess(ctx, applicationId);
  await prisma.applicationNote.create({ data: { applicationId, authorId: ctx.user.id, body } });
}

export async function assignApplicationRecruiter(ctx: StaffContext, applicationId: string, recruiterId: string | null) {
  await assertApplicationAccess(ctx, applicationId);
  if (recruiterId) {
    const staff = await prisma.user.findFirst({ where: { id: recruiterId, type: "STAFF", isActive: true } });
    if (!staff) throw new AppError("Select an active staff member.");
  }
  await prisma.application.update({ where: { id: applicationId }, data: { assignedRecruiterId: recruiterId } });
}
