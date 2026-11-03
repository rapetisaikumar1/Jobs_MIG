// File type/size rules for uploads. Pure module — used by the browser (early feedback)
// and the server (authoritative checks, including content signatures).

import type { DocumentType } from "@prisma/client";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

type FileKind = "pdf" | "docx" | "png" | "jpeg";

const KINDS: Record<FileKind, { mime: string; extensions: string[]; label: string }> = {
  pdf: { mime: "application/pdf", extensions: [".pdf"], label: "PDF" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: [".docx"],
    label: "DOCX",
  },
  png: { mime: "image/png", extensions: [".png"], label: "PNG" },
  jpeg: { mime: "image/jpeg", extensions: [".jpg", ".jpeg"], label: "JPG" },
};

export const ALLOWED_KINDS: Record<DocumentType, FileKind[]> = {
  RESUME: ["pdf", "docx"],
  COVER_LETTER: ["pdf", "docx"],
  SUPPORTING: ["pdf", "docx", "png", "jpeg"],
};

export const ALLOWED_MIME_TYPES = Object.values(KINDS).map((k) => k.mime);

export function acceptAttribute(type: DocumentType): string {
  return ALLOWED_KINDS[type].flatMap((k) => [...KINDS[k].extensions, KINDS[k].mime]).join(",");
}

export function allowedLabel(type: DocumentType): string {
  return ALLOWED_KINDS[type].map((k) => KINDS[k].label).join(", ");
}

function kindFromFileName(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase();
  const match = (Object.keys(KINDS) as FileKind[]).find((kind) =>
    KINDS[kind].extensions.some((ext) => lower.endsWith(ext)),
  );
  return match ?? null;
}

export type UploadCheck = { ok: true; kind: FileKind; mimeType: string } | { ok: false; error: string };

/** Validate an upload by declared name and size. The MIME type is derived from the extension. */
export function checkUpload(type: DocumentType, fileName: string, sizeBytes: number): UploadCheck {
  const kind = kindFromFileName(fileName);
  if (!kind || !ALLOWED_KINDS[type].includes(kind)) {
    return { ok: false, error: `Unsupported file type. Allowed: ${allowedLabel(type)}.` };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { ok: false, error: "The file is empty." };
  if (sizeBytes > MAX_FILE_BYTES) return { ok: false, error: "The file is larger than 10 MB." };
  return { ok: true, kind, mimeType: KINDS[kind].mime };
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

function containsAscii(bytes: Uint8Array, text: string): boolean {
  const needle = Array.from(text, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Verify the stored bytes really are the declared file kind (guards against renamed files). */
export function matchesFileSignature(fileName: string, bytes: Uint8Array): boolean {
  switch (kindFromFileName(fileName)) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "docx":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && containsAscii(bytes, "word/");
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    default:
      return false;
  }
}

/** Storage-safe file name that keeps the original extension. */
export function safeFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot).toLowerCase() : "";
  const stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned).slice(0, 80) || "file";
  return `${stem}${ext}`;
}

/** Display-safe original file name (no path components or control characters). */
export function displayFileName(fileName: string): string {
  const base = (fileName.split(/[\\/]/).pop() ?? "file").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return base.slice(0, 200) || "file";
}
