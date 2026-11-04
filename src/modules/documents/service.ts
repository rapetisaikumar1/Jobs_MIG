import "server-only";
import type { Document, DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/action-result";
import {
  checkUpload,
  displayFileName,
  MAX_FILE_BYTES,
  matchesFileSignature,
} from "@/modules/documents/file-rules";
import {
  copyObject,
  createSignedUpload,
  downloadObject,
  newStoragePath,
  removeObjects,
} from "@/modules/documents/storage";

/*
 * Upload lifecycle
 * 1. createUploadTicket: a PENDING document row + a short-lived signed upload URL.
 *    The browser uploads straight to the private bucket (no large bodies through our server).
 * 2. verifyPendingUploads: before saving the record that uses the files, the server checks
 *    ownership, that the object exists, its real size, and its content signature.
 * 3. activateDocuments: inside the same database transaction as the application/profile
 *    change, documents become ACTIVE and are linked. If the transaction fails they stay PENDING.
 * 4. cleanupAbandonedUploads (daily cron): deletes PENDING rows and objects older than 24h —
 *    interrupted uploads and failed submissions never leave orphaned files behind.
 */

export type UploadTicket = {
  bucket: string;
  documentId: string;
  path: string;
  token: string;
  fileName: string;
  sizeBytes: number;
  type: DocumentType;
};

export async function createUploadTicket(params: {
  actorUserId: string;
  candidateId: string | null;
  type: DocumentType;
  fileName: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  const check = checkUpload(params.type, params.fileName, params.sizeBytes);
  if (!check.ok) throw new AppError(check.error);

  const fileName = displayFileName(params.fileName);
  const { documentId, path } = newStoragePath(fileName);
  await prisma.document.create({
    data: {
      id: documentId,
      type: params.type,
      status: "PENDING",
      fileName,
      mimeType: check.mimeType,
      sizeBytes: params.sizeBytes,
      storagePath: path,
      candidateId: params.candidateId,
      uploadedById: params.actorUserId,
    },
  });
  const { token } = await createSignedUpload(path);
  return { bucket: serverEnv.documentsBucket, documentId, path, token, fileName, sizeBytes: params.sizeBytes, type: params.type };
}

/**
 * Confirms that pending uploads belong to the actor and that the stored bytes are
 * valid. Invalid files are deleted. Returns the documents with their verified sizes.
 */
export async function verifyPendingUploads(
  documentIds: string[],
  actorUserId: string,
  expectedTypes?: Partial<Record<string, DocumentType>>,
): Promise<Document[]> {
  const ids = [...new Set(documentIds)];
  if (!ids.length) return [];
  const docs = await prisma.document.findMany({
    where: { id: { in: ids }, status: "PENDING", uploadedById: actorUserId },
  });
  if (docs.length !== ids.length) {
    throw new AppError("One or more uploaded files could not be found. Please upload them again.");
  }

  for (const doc of docs) {
    const expected = expectedTypes?.[doc.id];
    if (expected && doc.type !== expected) throw new AppError(`"${doc.fileName}" was uploaded as the wrong document type.`);

    const bytes = await downloadObject(doc.storagePath);
    if (!bytes) throw new AppError(`The upload of "${doc.fileName}" did not complete. Please upload it again.`);
    if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES || !matchesFileSignature(doc.fileName, bytes)) {
      await removeObjects([doc.storagePath]).catch(() => undefined);
      await prisma.document.delete({ where: { id: doc.id } });
      throw new AppError(`"${doc.fileName}" is not a valid file of its type or is larger than 10 MB.`);
    }
    doc.sizeBytes = bytes.length;
  }
  return docs;
}

/** Marks verified documents ACTIVE and links them. Run inside the owning transaction. */
export async function activateDocuments(
  tx: Prisma.TransactionClient,
  docs: Pick<Document, "id" | "sizeBytes">[],
  link: { candidateId: string; applicationId?: string; folderId?: string },
): Promise<void> {
  const now = new Date();
  for (const doc of docs) {
    const result = await tx.document.updateMany({
      where: { id: doc.id, status: "PENDING" },
      data: {
        status: "ACTIVE",
        activatedAt: now,
        sizeBytes: doc.sizeBytes,
        candidateId: link.candidateId,
        applicationId: link.applicationId ?? null,
        folderId: link.folderId ?? null,
      },
    });
    if (result.count !== 1) throw new AppError("A document was modified during submission. Please try again.");
  }
}

/**
 * Copies a stored document into a new PENDING document owned by the actor.
 * Used so applications keep their own immutable copy of the resume submitted,
 * independent of later profile changes.
 */
export async function stageDocumentCopy(
  source: Pick<Document, "storagePath" | "fileName" | "mimeType" | "sizeBytes" | "type" | "candidateId">,
  actorUserId: string,
): Promise<Document> {
  const { documentId, path } = newStoragePath(source.fileName);
  const doc = await prisma.document.create({
    data: {
      id: documentId,
      type: source.type,
      status: "PENDING",
      fileName: source.fileName,
      mimeType: source.mimeType,
      sizeBytes: source.sizeBytes,
      storagePath: path,
      candidateId: source.candidateId,
      uploadedById: actorUserId,
    },
  });
  try {
    await copyObject(source.storagePath, path);
  } catch (error) {
    await prisma.document.delete({ where: { id: doc.id } });
    throw error;
  }
  return doc;
}

/** Deletes a profile-level document. Application documents are immutable and never deleted here. */
export async function deleteProfileDocument(documentId: string, candidateId: string): Promise<void> {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, candidateId, applicationId: null, folderId: null },
  });
  if (!doc) throw new AppError("Document not found.");
  await prisma.$transaction(async (tx) => {
    await tx.document.delete({ where: { id: doc.id } }); // clears defaultResumeId if it was the default (FK SET NULL)
    // Same rule as uploading: a candidate with resumes on file always has a default one.
    const profile = await tx.candidateProfile.findUnique({ where: { id: candidateId }, select: { defaultResumeId: true } });
    if (profile && !profile.defaultResumeId) {
      const next = await tx.document.findFirst({
        where: { candidateId, type: "RESUME", status: "ACTIVE", applicationId: null, folderId: null },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (next) await tx.candidateProfile.update({ where: { id: candidateId }, data: { defaultResumeId: next.id } });
    }
  });
  await removeObjects([doc.storagePath]).catch((error) => console.error("[documents] remove failed", error));
}

export async function cleanupAbandonedUploads(olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const stale = await prisma.document.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true, storagePath: true },
    take: 500,
  });
  if (!stale.length) return 0;
  // Delete the rows first and only remove the files of rows that were still PENDING: a form
  // submitted at this moment may have just activated one of them, and its file must survive.
  const deleted = await prisma.$queryRaw<{ storage_path: string }[]>`
    DELETE FROM documents WHERE id = ANY(${stale.map((d) => d.id)}::uuid[]) AND status = 'PENDING'
    RETURNING storage_path`;
  // Missing objects (upload never finished) are ignored by the storage API.
  if (deleted.length) await removeObjects(deleted.map((d) => d.storage_path));
  return deleted.length;
}

/** Rate-limit counters older than any window are dead weight; keep the table small. */
export async function purgeExpiredRateLimits(): Promise<number> {
  return prisma.$executeRaw`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`;
}
