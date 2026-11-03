import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { uuid } from "@/lib/validation";
import { getStaffContext } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { applicationScopeWhere } from "@/modules/access-control/scope";
import { getCandidateContext } from "@/modules/auth/session";
import { createSignedDownloadUrl } from "@/modules/documents/storage";

const noStore = { "Cache-Control": "no-store" };

function deny(status: 403 | 404) {
  return new NextResponse(status === 404 ? "Not found" : "Forbidden", { status, headers: noStore });
}

/**
 * Secure document access. Authorizes the caller, then redirects to a signed URL
 * that expires after 60 seconds. Files are never publicly reachable.
 *   - Candidates: only their own documents.
 *   - Staff: "document.view", plus "candidate.view" for profile documents, or
 *     "application.view" and access to the application's job for application documents.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const parsedId = uuid.safeParse((await params).documentId);
  if (!parsedId.success) return deny(404);

  const doc = await prisma.document.findUnique({ where: { id: parsedId.data } });
  if (!doc || doc.status !== "ACTIVE") return deny(404);

  const staff = await getStaffContext();
  if (staff) {
    if (!staff.can(PERMISSIONS.DOCUMENT_VIEW)) return deny(403);
    if (doc.applicationId) {
      if (!staff.can(PERMISSIONS.APPLICATION_VIEW)) return deny(403);
      const inScope = await prisma.application.count({
        where: { AND: [{ id: doc.applicationId }, applicationScopeWhere(staff)] },
      });
      if (!inScope) return deny(403);
    } else if (!staff.can(PERMISSIONS.CANDIDATE_VIEW)) {
      return deny(403);
    }
  } else {
    const candidate = await getCandidateContext();
    if (!candidate || doc.candidateId !== candidate.profile.id) return deny(403);
  }

  const inline = request.nextUrl.searchParams.get("inline") === "1" && doc.mimeType === "application/pdf";
  const url = await createSignedDownloadUrl(doc.storagePath, doc.fileName, 60);
  // Supabase adds ?download=<name> to force a download; strip it to open PDFs in the browser.
  const target = new URL(url);
  if (inline) target.searchParams.delete("download");
  return NextResponse.redirect(target, { status: 303, headers: noStore });
}
