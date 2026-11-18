import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Folder, FolderOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClickableRow } from "@/components/case-files/clickable-row";
import { ExplorerPanel, FolderIcon, NameCell, RelativeTime, itemCount } from "@/components/case-files/explorer";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, redirectPastLastPage } from "@/components/shared/pagination";
import { RowActionsMenu, type RowAction } from "@/components/shared/row-actions-menu";
import { ApplicationStatusBadge, JobStatusBadge } from "@/components/shared/status-badges";
import { fullName } from "@/lib/format";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { CASE_FOLDER_PAGE_SIZE, getCaseFile } from "@/modules/case-files/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Case files" };

/** A job's case file: one application folder per application, as an explorer table. */
export default async function JobFoldersPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CASE_FILE_VIEW);
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = param(sp, "q")?.slice(0, 100);
  const { jobId } = await params;
  const [data, tz] = await Promise.all([getCaseFile(ctx, jobId, q, page, CASE_FOLDER_PAGE_SIZE), getViewerTimeZone()]);
  if (!data) notFound();
  const { job, caseFile, folders, total } = data;
  const basePath = `/admin/case-files/${job.displayId}`;
  redirectPastLastPage(basePath, sp, page, CASE_FOLDER_PAGE_SIZE, total);
  const canViewApplication = ctx.can(PERMISSIONS.APPLICATION_VIEW);
  const folderTotal = caseFile._count.folders;

  return (
    <>
      <Breadcrumbs items={[{ label: "Case files", href: "/admin/case-files" }, { label: `${caseFile.displayId} — ${job.title}` }]} />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{job.title} <JobStatusBadge status={job.status} /></span>}
        description={
          <>
            <Link href={`/admin/jobs/${job.displayId}`} className="hover:text-foreground hover:underline">{job.displayId}</Link>
            {" · "}{caseFile.displayId}
            {/* Internal only: getCaseFile returns the client only to staff who may view clients. */}
            {job.client && (
              <>
                {" · "}Source{" "}
                <Link href={`/admin/sources/${job.client.id}`} className="hover:text-foreground hover:underline">{job.client.name}</Link>
              </>
            )}
            {" · "}{itemCount(folderTotal, "application folder")}
            {" · "}Created by {fullName(job.createdBy)}
          </>
        }
      />
      <ExplorerPanel
        toolbar={
          <LiveSearchForm className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Search name, email, ID, skill" className="w-full sm:w-80" aria-label="Search folders" />
            <Button type="submit" variant="outline" size="icon" aria-label="Search"><Search /></Button>
          </LiveSearchForm>
        }
        summary={
          q ? (
            <>
              {itemCount(total, "folder")} matching “{q}” · <Link href={basePath} className="underline hover:text-foreground">Clear</Link>
            </>
          ) : (
            itemCount(total, "folder")
          )
        }
      >
        {folders.length ? (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH className="hidden sm:table-cell">Application status</TH>
                <TH className="hidden text-right sm:table-cell">Items</TH>
                <TH className="hidden xl:table-cell">Applied</TH>
                <TH className="hidden md:table-cell">Modified</TH>
                <TH className="w-12"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              {folders.map((folder) => {
                const app = folder.application;
                const href = `${basePath}/${app.displayId}`;
                const items = folder._count.documents + 1; // documents + the application details record
                const actions: RowAction[] = [{ label: "Open folder", href, icon: <FolderOpen /> }];
                if (canViewApplication) actions.push({ label: "Open application", href: `/admin/applications/${app.displayId}`, icon: <ClipboardList /> });
                return (
                  <ClickableRow key={folder.id}>
                    <TD className="py-2.5 sm:min-w-64">
                      <NameCell
                        icon={<FolderIcon />}
                        name={fullName(app.candidate)}
                        href={href}
                        title={`${folder.displayId} — ${fullName(app.candidate)}`}
                        secondary={<>{app.displayId} · {folder.displayId}</>}
                        className="max-w-[calc(100vw-8.5rem)] sm:max-w-[16rem] 2xl:max-w-[26rem]"
                      />
                      {/* Phones: the status column is hidden, so show the badge here. */}
                      <div className="mt-1 pl-12 sm:hidden"><ApplicationStatusBadge status={app.status} /></div>
                    </TD>
                    <TD className="hidden sm:table-cell"><ApplicationStatusBadge status={app.status} /></TD>
                    <TD className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell" title={`${itemCount(folder._count.documents, "document")} + application details`}>
                      {items}
                    </TD>
                    <TD className="hidden text-muted-foreground xl:table-cell"><RelativeTime date={app.appliedAt} timeZone={tz} /></TD>
                    <TD className="hidden text-muted-foreground md:table-cell"><RelativeTime date={app.updatedAt} timeZone={tz} /></TD>
                    <TD className="py-1 text-right">
                      <RowActionsMenu label={`Actions for ${fullName(app.candidate)}`} actions={actions} />
                    </TD>
                  </ClickableRow>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <EmptyState
            className="m-4"
            icon={<Folder />}
            title={q ? "No folders match your search" : "No applications yet"}
            description="Each application to this job gets its own folder here automatically."
          />
        )}
      </ExplorerPanel>
      <Pagination basePath={basePath} params={sp} page={page} pageSize={CASE_FOLDER_PAGE_SIZE} total={total} />
    </>
  );
}
