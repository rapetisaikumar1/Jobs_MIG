"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runAction } from "@/lib/action";
import { AppError, ForbiddenError, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkbox, uuid } from "@/lib/validation";
import { getStaffContext, requireStaffForAction } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { getCandidateContext } from "@/modules/auth/session";
import {
  activateDocuments,
  createUploadTicket,
  deleteProfileDocument,
  verifyPendingUploads,
  type UploadTicket,
} from "@/modules/documents/service";

const uploadRequestSchema = z.object({
  type: z.enum(["RESUME", "COVER_LETTER", "SUPPORTING"]),
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  candidateId: uuid.optional(),
});

/** Issues a signed upload URL to a signed-in candidate (own profile) or authorized staff. */
export async function requestUploadAction(input: z.input<typeof uploadRequestSchema>): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const parsed = uploadRequestSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { type, fileName, sizeBytes, candidateId } = parsed.data;

    const staff = await getStaffContext();
    if (staff) {
      if (![PERMISSIONS.CANDIDATE_ADD, PERMISSIONS.CANDIDATE_EDIT, PERMISSIONS.APPLICATION_CREATE].some((p) => staff.can(p))) throw new ForbiddenError();
      if (candidateId && !(await prisma.candidateProfile.count({ where: { id: candidateId } }))) {
        throw new AppError("Candidate not found.");
      }
      await enforceRateLimit("upload", staff.user.id);
      return ok(await createUploadTicket({ actorUserId: staff.user.id, candidateId: candidateId ?? null, type, fileName, sizeBytes }));
    }

    const candidate = await getCandidateContext();
    if (!candidate) throw new ForbiddenError("Please sign in to upload documents.");
    await enforceRateLimit("upload", candidate.user.id);
    return ok(
      await createUploadTicket({ actorUserId: candidate.user.id, candidateId: candidate.profile.id, type, fileName, sizeBytes }),
    );
  });
}

const attachSchema = z.object({ documentId: uuid, makeDefault: checkbox, candidateId: uuid.optional() });

/** Saves an uploaded file to a candidate profile (and optionally makes it the default resume). */
export async function attachProfileDocumentAction(input: z.input<typeof attachSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = attachSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { documentId, makeDefault } = parsed.data;

    let actorId: string;
    let candidateId: string;
    const staff = await getStaffContext();
    if (staff) {
      if (!staff.can(PERMISSIONS.CANDIDATE_EDIT)) throw new ForbiddenError();
      if (!parsed.data.candidateId) throw new AppError("Candidate is required.");
      actorId = staff.user.id;
      candidateId = parsed.data.candidateId;
    } else {
      const candidate = await getCandidateContext();
      if (!candidate) throw new ForbiddenError("Please sign in.");
      actorId = candidate.user.id;
      candidateId = candidate.profile.id;
    }

    const [doc] = await verifyPendingUploads([documentId], actorId);
    await prisma.$transaction(async (tx) => {
      await activateDocuments(tx, [doc], { candidateId });
      if (doc.type === "RESUME") {
        const profile = await tx.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } });
        if (makeDefault || !profile.defaultResumeId) {
          await tx.candidateProfile.update({ where: { id: candidateId }, data: { defaultResumeId: doc.id } });
        }
      }
    });
    revalidatePath(staff ? "/admin/candidates" : "/candidate/profile", "layout");
    return ok(undefined, "Document saved.");
  });
}

const documentRefSchema = z.object({ documentId: uuid, candidateId: uuid.optional() });

async function resolveProfileOwner(candidateIdForStaff?: string) {
  const staff = await getStaffContext();
  if (staff) {
    await requireStaffForAction(PERMISSIONS.CANDIDATE_EDIT);
    if (!candidateIdForStaff) throw new AppError("Candidate is required.");
    return { staff, candidateId: candidateIdForStaff };
  }
  const candidate = await getCandidateContext();
  if (!candidate) throw new ForbiddenError("Please sign in.");
  return { staff: null, candidateId: candidate.profile.id };
}

export async function setDefaultResumeAction(input: z.input<typeof documentRefSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = documentRefSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { staff, candidateId } = await resolveProfileOwner(parsed.data.candidateId);
    const doc = await prisma.document.findFirst({
      where: { id: parsed.data.documentId, candidateId, type: "RESUME", status: "ACTIVE", applicationId: null },
    });
    if (!doc) throw new AppError("Resume not found.");
    await prisma.candidateProfile.update({ where: { id: candidateId }, data: { defaultResumeId: doc.id } });
    revalidatePath(staff ? "/admin/candidates" : "/candidate/profile", "layout");
    return ok(undefined, "Default resume updated.");
  });
}

export async function deleteProfileDocumentAction(input: z.input<typeof documentRefSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = documentRefSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { staff, candidateId } = await resolveProfileOwner(parsed.data.candidateId);
    await deleteProfileDocument(parsed.data.documentId, candidateId);
    revalidatePath(staff ? "/admin/candidates" : "/candidate/profile", "layout");
    return ok(undefined, "Document removed.");
  });
}
