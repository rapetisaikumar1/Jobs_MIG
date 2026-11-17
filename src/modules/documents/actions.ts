"use server";

import { stripControlChars } from "@/lib/utils";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { runAction } from "@/lib/action";
import { AppError, ForbiddenError, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkbox, uuid } from "@/lib/validation";
import { getCandidateContextStrict } from "@/modules/auth/session";
import {
  activateDocuments,
  createUploadTicket,
  deleteProfileDocument,
  verifyPendingUploads,
  type UploadTicket,
} from "@/modules/documents/service";

/**
 * Every action here works on the signed-in candidate's own documents only. Callers may still
 * pass `candidateId` (older component props); it is ignored and never trusted.
 */
type IgnoredCandidateId = { candidateId?: string };

const uploadRequestSchema = z.object({
  type: z.enum(["RESUME", "COVER_LETTER", "SUPPORTING"]),
  fileName: z.string().transform(stripControlChars).pipe(z.string().trim().min(1).max(255)),
  sizeBytes: z.number().int().positive(),
});

/** Issues a signed upload URL to a signed-in candidate (for their profile or an application). */
export async function requestUploadAction(
  input: z.input<typeof uploadRequestSchema> & IgnoredCandidateId,
): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const parsed = uploadRequestSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { type, fileName, sizeBytes } = parsed.data;

    const candidate = await getCandidateContextStrict();
    if (!candidate) throw new ForbiddenError("Please sign in to upload documents.");
    await enforceRateLimit("upload", candidate.user.id);
    return ok(
      await createUploadTicket({ actorUserId: candidate.user.id, candidateId: candidate.profile.id, type, fileName, sizeBytes }),
    );
  });
}

const attachSchema = z.object({ documentId: uuid, makeDefault: checkbox });

/** Saves an uploaded file to the candidate's profile (and optionally makes it the default resume). */
export async function attachProfileDocumentAction(input: z.input<typeof attachSchema> & IgnoredCandidateId): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = attachSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const { documentId, makeDefault } = parsed.data;

    const candidate = await getCandidateContextStrict();
    if (!candidate) throw new ForbiddenError("Please sign in.");
    const candidateId = candidate.profile.id;

    const [doc] = await verifyPendingUploads([documentId], candidate.user.id);
    await prisma.$transaction(async (tx) => {
      await activateDocuments(tx, [doc], { candidateId });
      if (doc.type === "RESUME") {
        const profile = await tx.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } });
        if (makeDefault || !profile.defaultResumeId) {
          await tx.candidateProfile.update({ where: { id: candidateId }, data: { defaultResumeId: doc.id } });
        }
      }
    });
    revalidatePath("/candidate/profile", "layout");
    return ok(undefined, "Document saved.");
  });
}

const documentRefSchema = z.object({ documentId: uuid });

async function requireProfileOwner(): Promise<string> {
  const candidate = await getCandidateContextStrict();
  if (!candidate) throw new ForbiddenError("Please sign in.");
  return candidate.profile.id;
}

export async function setDefaultResumeAction(input: z.input<typeof documentRefSchema> & IgnoredCandidateId): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = documentRefSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const candidateId = await requireProfileOwner();
    const doc = await prisma.document.findFirst({
      where: { id: parsed.data.documentId, candidateId, type: "RESUME", status: "ACTIVE", applicationId: null },
    });
    if (!doc) throw new AppError("Resume not found.");
    await prisma.candidateProfile.update({ where: { id: candidateId }, data: { defaultResumeId: doc.id } });
    revalidatePath("/candidate/profile", "layout");
    return ok(undefined, "Default resume updated.");
  });
}

export async function deleteProfileDocumentAction(input: z.input<typeof documentRefSchema> & IgnoredCandidateId): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = documentRefSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const candidateId = await requireProfileOwner();
    await deleteProfileDocument(parsed.data.documentId, candidateId);
    revalidatePath("/candidate/profile", "layout");
    return ok(undefined, "Document removed.");
  });
}
