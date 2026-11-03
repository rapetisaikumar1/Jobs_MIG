import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Download, Eye, FileText, Image as ImageIcon } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { DOCUMENT_TYPE_LABELS, SOURCE_LABELS } from "@/config/options";
import { formatDate, formatFileSize, fullName } from "@/lib/format";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { getCaseFolder } from "@/modules/case-files/queries";

export const metadata: Metadata = { title: "Application folder" };

const cardClass =
  "group flex flex-col rounded-lg border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md";

/** Contents of one application folder: the application details and its submitted documents. */
export default async function ApplicationFolderContentsPage({ params }: { params: Promise<{ jobId: string; applicationId: string }> }) {
  const ctx = await requireStaff(PERMISSIONS.CASE_FILE_VIEW);
  const { jobId, applicationId } = await params;
  const folder = await getCaseFolder(ctx, jobId, applicationId);
  if (!folder) notFound();
  const tz = await getViewerTimeZone();
  const { application: app, caseFile } = folder;
  const job = caseFile.job;
  const name = fullName(app.candidate);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Case files", href: "/admin/case-files" },
          { label: job.title, href: `/admin/case-files/${job.displayId}` },
          { label: `${app.displayId} — ${name}` },
        ]}
      />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{name} <ApplicationStatusBadge status={app.status} /></span>}
        description={`${app.displayId} · ${SOURCE_LABELS[app.source]} · Applied ${formatDate(app.appliedAt, tz)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {ctx.can(PERMISSIONS.APPLICATION_VIEW) && (
          <Link href={`/admin/applications/${app.displayId}`} className={cardClass}>
            <span className="flex size-10 items-center justify-center rounded-md border bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <ClipboardList className="size-5" aria-hidden />
            </span>
            <p className="mt-4 font-semibold">Application Details</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Candidate profile, status, notes and history</p>
            <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">Open</div>
          </Link>
        )}

        {folder.documents.map((doc) => {
          const isPdf = doc.mimeType === "application/pdf";
          const Icon = doc.mimeType.startsWith("image/") ? ImageIcon : FileText;
          return (
            <div key={doc.id} className={cardClass}>
              <span className="flex size-10 items-center justify-center rounded-md border bg-muted">
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="mt-4 truncate font-semibold" title={doc.fileName}>{doc.fileName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {DOCUMENT_TYPE_LABELS[doc.type]} · {formatFileSize(doc.sizeBytes)}
              </p>
              <div className="mt-4 flex items-center gap-4 border-t pt-3 text-xs">
                {isPdf && (
                  <a href={`/api/documents/${doc.id}?inline=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                    <Eye className="size-3.5" aria-hidden /> View
                  </a>
                )}
                <a href={`/api/documents/${doc.id}`} className="inline-flex items-center gap-1 font-medium hover:underline">
                  <Download className="size-3.5" aria-hidden /> Download
                </a>
                <span className="ml-auto text-muted-foreground">{formatDate(doc.createdAt, tz)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {folder.documents.length === 0 && (
        <EmptyState
          className="mt-4"
          icon={<FileText />}
          title="No documents in this folder"
          description="Resumes, cover letters and supporting documents submitted with the application appear here."
        />
      )}
    </>
  );
}
