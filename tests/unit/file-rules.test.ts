import { describe, expect, it } from "vitest";
import { checkUpload, matchesFileSignature, MAX_FILE_BYTES, safeFileName } from "@/modules/documents/file-rules";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("upload validation", () => {
  it("accepts PDF and DOCX resumes", () => {
    expect(checkUpload("RESUME", "cv.pdf", 1000)).toMatchObject({ ok: true, mimeType: "application/pdf" });
    expect(checkUpload("RESUME", "CV.DOCX", 1000)).toMatchObject({ ok: true });
  });
  it("rejects other resume formats", () => {
    expect(checkUpload("RESUME", "cv.png", 1000).ok).toBe(false);
    expect(checkUpload("RESUME", "cv.exe", 1000).ok).toBe(false);
    expect(checkUpload("RESUME", "cv.pdf.exe", 1000).ok).toBe(false);
  });
  it("allows images only as supporting documents", () => {
    expect(checkUpload("SUPPORTING", "cert.jpg", 1000).ok).toBe(true);
  });
  it("enforces the 10 MB limit and non-empty files", () => {
    expect(checkUpload("RESUME", "cv.pdf", MAX_FILE_BYTES + 1).ok).toBe(false);
    expect(checkUpload("RESUME", "cv.pdf", 0).ok).toBe(false);
  });
});

describe("content signatures", () => {
  it("detects real PDFs", () => {
    expect(matchesFileSignature("a.pdf", ascii("%PDF-1.7 ..."))).toBe(true);
    expect(matchesFileSignature("a.pdf", ascii("<html>"))).toBe(false);
  });
  it("requires a Word package for DOCX", () => {
    const zipHeader = [0x50, 0x4b, 0x03, 0x04];
    expect(matchesFileSignature("a.docx", new Uint8Array([...zipHeader, ...ascii("word/document.xml")]))).toBe(true);
    expect(matchesFileSignature("a.docx", bytes(...zipHeader, 0, 0))).toBe(false);
  });
  it("rejects a renamed executable", () => expect(matchesFileSignature("a.pdf", bytes(0x4d, 0x5a))).toBe(false));
});

describe("safe file names", () => {
  it("strips paths and unsafe characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("My Résumé (final).pdf")).toBe("My-Resume-final.pdf");
  });
});
