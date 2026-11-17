import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Download, Eye, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClickableRow } from "@/components/case-files/clickable-row";
import { ExplorerPanel, ExtensionPill, ItemIcon, NameCell, RelativeTime, fileKind, itemCount } from "@/components/case-files/explorer";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { DOCUMENT_TYPE_LABELS, SOURCE_LABELS } from "@/config/options";
import { formatDate, formatFileSize, fullName } from "@/lib/format";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { getCaseFolder } from "@/modules/case-files/queries";

export const metadata: Metadata = { title: "Application folder" };

const actionLink =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&_svg]:size-3.5";

/** Contents of one application folder: the application details record and its submitted documents. */
export default async function ApplicationFolderContentsPage({ params }: { params: Promise<{ jobId: string; applicationId: string }> }) {
  const ctx = await requireStaff(PERMISSIONS.CASE_FILE_VIEW);
  const { jobId, applicationId } = await params;
  const [folder, tz] = await Promise.all([getCaseFolder(ctx, jobId, applicationId), getViewerTimeZone()]);
  if (!folder) notFound();
  const { application: app, caseFile } = folder;
  const job = caseFile.job;
  const name = fullName(app.candidate);
  // /api/documents also requires application.view (and the application's scope), so without it
  // the View / Download links would only lead to a 403: show "No access" instead.
  const canOpenDocuments = ctx.can(PERMISSIONS.DOCUMENT_VIEW) && ctx.can(PERMISSIONS.APPLICATION_VIEW);
  const canViewApplication = ctx.can(PERMISSIONS.APPLICATION_VIEW);
  const applicationHref = `/admin/applications/${app.displayId}`;
  const total = folder.documents.length + 1;

  const applicationCells = (
    <>
      <TD className="py-2.5 sm:min-w-56">
        <NameCell
          icon={<ItemIcon className="text-foreground"><ClipboardList /></ItemIcon>}
          name="Application details"
          href={canViewApplication ? applicationHref : undefined}
          secondary="Candidate profile, status, notes and history"
          className="max-w-[calc(100vw-11rem)] sm:max-w-[14rem] 2xl:max-w-[26rem]"
        />
      </TD>
      <TD className="hidden sm:table-cell"><Badge tone="outline">Record</Badge></TD>
      <TD className="hidden text-right text-muted-foreground xl:table-cell">—</TD>
      <TD className="hidden text-muted-foreground 2xl:table-cell">—</TD>
      <TD className="hidden text-muted-foreground md:table-cell"><RelativeTime date={app.appliedAt} timeZone={tz} /></TD>
      <TD className="py-1 text-right">
        {canViewApplication ? (
          <Link href={applicationHref} className={actionLink} aria-label="Open application details">Open</Link>
        ) : (
          <span className="text-xs text-muted-foreground">No access</span>
        )}
      </TD>
    </>
  );

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Case files", href: "/admin/case-files" },
          { label: `${caseFile.displayId} — ${job.title}`, href: `/admin/case-files/${job.displayId}` },
          { label: `${app.displayId} — ${name}` },
        ]}
      />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{name} <ApplicationStatusBadge status={app.status} /></span>}
        description={`${app.displayId} · ${folder.displayId} · ${SOURCE_LABELS[app.source]} · Applied ${formatDate(app.appliedAt, tz)}`}
      />

      <ExplorerPanel
        summary={
          <>
            {itemCount(total)}
            {!canOpenDocuments && folder.documents.length > 0 && " · You don't have access to open documents"}
          </>
        }
      >
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH className="hidden sm:table-cell">Type</TH>
              <TH className="hidden text-right xl:table-cell">Size</TH>
              <TH className="hidden 2xl:table-cell">Uploaded by</TH>
              <TH className="hidden md:table-cell">Added</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {canViewApplication ? <ClickableRow>{applicationCells}</ClickableRow> : <TR>{applicationCells}</TR>}

            {folder.documents.map((doc) => {
              const kind = fileKind(doc.mimeType, doc.fileName);
              const viewHref = `/api/documents/${doc.id}?inline=1`;
              const downloadHref = `/api/documents/${doc.id}`;
              return (
                <TR key={doc.id}>
                  <TD className="py-2.5 sm:min-w-56">
                    <NameCell
                      icon={<ItemIcon className={kind.className}><kind.Icon /></ItemIcon>}
                      name={doc.fileName}
                      title={doc.fileName}
                      href={canOpenDocuments ? (kind.isPdf ? viewHref : downloadHref) : undefined}
                      newTab={kind.isPdf}
                      secondary={<><ExtensionPill>{kind.label}</ExtensionPill><span className="sm:hidden"> · {DOCUMENT_TYPE_LABELS[doc.type]}</span></>}
                      className="max-w-[calc(100vw-11rem)] sm:max-w-[14rem] 2xl:max-w-[26rem]"
                    />
                  </TD>
                  <TD className="hidden sm:table-cell"><Badge tone={doc.type === "RESUME" ? "info" : "neutral"}>{DOCUMENT_TYPE_LABELS[doc.type]}</Badge></TD>
                  <TD className="hidden whitespace-nowrap text-right tabular-nums text-muted-foreground xl:table-cell">{formatFileSize(doc.sizeBytes)}</TD>
                  <TD className="hidden 2xl:table-cell">{doc.uploadedBy ? <span className="block max-w-40 truncate whitespace-nowrap" title={fullName(doc.uploadedBy)}>{fullName(doc.uploadedBy)}</span> : "—"}</TD>
                  <TD className="hidden text-muted-foreground md:table-cell"><RelativeTime date={doc.createdAt} timeZone={tz} /></TD>
                  <TD className="py-1 text-right">
                    {canOpenDocuments ? (
                      <span className="inline-flex items-center justify-end gap-1">
                        {kind.isPdf && (
                          <a href={viewHref} target="_blank" rel="noopener noreferrer" className={actionLink} aria-label={`View ${doc.fileName}`} title="View">
                            <Eye aria-hidden /> <span className="hidden sm:inline">View</span>
                          </a>
                        )}
                        <a href={downloadHref} className={actionLink} aria-label={`Download ${doc.fileName}`} title="Download">
                          <Download aria-hidden /> <span className="hidden sm:inline">Download</span>
                        </a>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No access</span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {folder.documents.length === 0 && (
          <div className="flex items-center gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
            <FileText className="size-4" aria-hidden />
            No documents in this folder. Resumes, cover letters and supporting documents submitted with the application appear here.
          </div>
        )}
      </ExplorerPanel>
    </>
  );
}
