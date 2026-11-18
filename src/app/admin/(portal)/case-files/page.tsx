import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Folder, FolderOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ClickableRow } from "@/components/case-files/clickable-row";
import { ExplorerPanel, FolderIcon, NameCell, RelativeTime, itemCount } from "@/components/case-files/explorer";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, redirectPastLastPage } from "@/components/shared/pagination";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { JobStatusBadge } from "@/components/shared/status-badges";
import { fullName } from "@/lib/format";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listCaseFiles } from "@/modules/case-files/queries";
import { listClientOptions } from "@/modules/clients/queries";
import { parseClientFilter } from "@/modules/jobs/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Case files" };

const PAGE_SIZE = 48;

/** All case files (one per job) as an explorer table. Opening one shows its application folders. */
export default async function CaseFilesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CASE_FILE_VIEW);
  const params = await searchParams;
  const page = parsePage(params.page);
  const q = param(params, "q")?.slice(0, 100);
  // Clients are internal: the Client column and filter are only for staff who may view clients.
  // A case file's client is its job's client.
  const canViewClients = ctx.can(PERMISSIONS.CLIENT_VIEW);
  const client = parseClientFilter(ctx, param(params, "client"));
  const [{ total, caseFiles }, tz, clients] = await Promise.all([
    listCaseFiles(ctx, { q, client }, page, PAGE_SIZE),
    getViewerTimeZone(),
    canViewClients ? listClientOptions() : [],
  ]);

  redirectPastLastPage("/admin/case-files", params, page, PAGE_SIZE, total);
  return (
    <>
      <PageHeader title="Case files" description="One case file per job. Open a case file to see its application folders." />
      <ExplorerPanel
        toolbar={
          <LiveSearchForm className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Search by job title, job ID or case file ID" className="w-full sm:w-80" aria-label="Search case files" />
            {canViewClients && (
              <Select name="client" defaultValue={client ?? ""} className="w-36 shrink-0 sm:w-44" aria-label="Source">
                <option value="">All sources</option>
                <option value="none">No source</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.isActive ? c.name : `${c.name} (inactive)`}</option>)}
              </Select>
            )}
            <Button type="submit" variant="outline" size="icon" aria-label="Search"><Search /></Button>
          </LiveSearchForm>
        }
        summary={
          q || client ? (
            <>
              {itemCount(total, "case file")}{q && <> matching “{q}”</>} · <Link href="/admin/case-files" className="underline hover:text-foreground">Clear</Link>
            </>
          ) : (
            itemCount(total, "case file")
          )
        }
      >
        {caseFiles.length ? (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                {canViewClients && <TH className="hidden xl:table-cell">Source</TH>}
                <TH className="hidden sm:table-cell">Job status</TH>
                <TH className="hidden text-right sm:table-cell">Items</TH>
                <TH className="hidden md:table-cell">Last activity</TH>
                <TH className="hidden 2xl:table-cell">Created</TH>
                <TH className="hidden 2xl:table-cell">Created by</TH>
                <TH className="w-12"><span className="sr-only">Actions</span></TH>
              </TR>
            </THead>
            <TBody>
              {caseFiles.map((cf) => {
                const href = `/admin/case-files/${cf.job.displayId}`;
                const folders = cf._count.folders;
                const createdBy = fullName(cf.job.createdBy);
                return (
                  <ClickableRow key={cf.id}>
                    <TD className="py-2.5 sm:min-w-64">
                      <NameCell
                        icon={<FolderIcon />}
                        name={cf.job.title}
                        href={href}
                        title={`${cf.displayId} — ${cf.job.title}`}
                        secondary={
                          <>
                            {cf.displayId} · {cf.job.displayId}
                            {/* The Client column is hidden below xl, so show the client here. */}
                            {cf.job.client && <span className="xl:hidden"> · {cf.job.client.name}</span>}
                          </>
                        }
                        className={canViewClients ? "max-w-[calc(100vw-8.5rem)] sm:max-w-[17rem] xl:max-w-[18rem] 2xl:max-w-[22rem]" : "max-w-[calc(100vw-8.5rem)] sm:max-w-[17rem] xl:max-w-[24rem]"}
                      />
                      {/* Phones: the Job status column is hidden, so show the badge here. */}
                      <div className="mt-1 pl-12 sm:hidden"><JobStatusBadge status={cf.job.status} /></div>
                    </TD>
                    {canViewClients && (
                      <TD className="hidden xl:table-cell">
                        {cf.job.client ? <span className="block max-w-40 truncate whitespace-nowrap" title={cf.job.client.name}>{cf.job.client.name}</span> : <span className="text-muted-foreground">—</span>}
                      </TD>
                    )}
                    <TD className="hidden sm:table-cell"><JobStatusBadge status={cf.job.status} /></TD>
                    <TD className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell" title={`${itemCount(folders, "application folder")}`}>
                      {folders ? folders.toLocaleString("en-US") : <span className="text-muted-foreground">Empty</span>}
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell"><RelativeTime date={cf.lastActivityAt} timeZone={tz} /></TD>
                    <TD className="hidden text-muted-foreground 2xl:table-cell"><RelativeTime date={cf.createdAt} timeZone={tz} /></TD>
                    <TD className="hidden 2xl:table-cell"><span className="block max-w-40 truncate whitespace-nowrap" title={createdBy}>{createdBy}</span></TD>
                    <TD className="py-1 text-right">
                      <RowActionsMenu
                        label={`Actions for ${cf.displayId}`}
                        actions={[
                          { label: "Open", href, icon: <FolderOpen /> },
                          { label: "Open job", href: `/admin/jobs/${cf.job.displayId}`, icon: <Briefcase /> },
                        ]}
                      />
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
            title={q || client ? "No case files match" : "No case files yet"}
            description="A case file is created automatically for every new job."
          />
        )}
      </ExplorerPanel>
      <Pagination basePath="/admin/case-files" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
