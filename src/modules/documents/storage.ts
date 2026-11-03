import "server-only";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeFileName } from "@/modules/documents/file-rules";

/** All candidate documents live in one private bucket; folders are virtual (database driven). */
function bucket() {
  return supabaseAdmin().storage.from(serverEnv.documentsBucket);
}

export function newStoragePath(fileName: string, documentId = randomUUID()): { documentId: string; path: string } {
  const year = new Date().getUTCFullYear();
  return { documentId, path: `documents/${year}/${documentId}/${safeFileName(fileName)}` };
}

export async function createSignedUpload(path: string): Promise<{ token: string }> {
  const { data, error } = await bucket().createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
  return { token: data.token };
}

export async function downloadObject(path: string): Promise<Uint8Array | null> {
  const { data, error } = await bucket().download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function copyObject(fromPath: string, toPath: string): Promise<void> {
  const { error } = await bucket().copy(fromPath, toPath);
  if (error) throw new Error(`Could not copy document: ${error.message}`);
}

export async function removeObjects(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await bucket().remove(paths);
  if (error) throw new Error(`Could not remove documents: ${error.message}`);
}

/** Short-lived download link (default 60 seconds). */
export async function createSignedDownloadUrl(path: string, fileName: string, expiresIn = 60): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, expiresIn, { download: fileName });
  if (error || !data) throw new Error(`Could not create download URL: ${error?.message}`);
  return data.signedUrl;
}
