import type { Metadata } from "next";
import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import { ClipboardList, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, redirectPastLastPage } from "@/components/shared/pagination";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { APPLICATION_STATUS_LABELS, SOURCE_LABELS, toOptions } from "@/config/options";
import { formatDate, fullName } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, param, parsePage, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listApplications } from "@/modules/applications/queries";
import { listClientOptions } from "@/modules/clients/queries";
import { parseClientFilter } from "@/modules/jobs/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.APPLICATION_VIEW);
  const params = await searchParams;
  const page = parsePage(params.page);
  const s = param(params, "status");
  const filters = {
    q: param(params, "q")?.slice(0, 100),
    status: s && s in APPLICATION_STATUS_LABELS ? (s as ApplicationStatus) : undefined,
    job: param(params, "job")?.slice(0, 30),
    client: parseClientFilter(ctx, param(params, "client")),
  };
  // Clients are internal: the Client column, filter and search are only for staff who may view clients.
  const canViewClients = ctx.can(PERMISSIONS.CLIENT_VIEW);
  const [{ total, rows }, tz, clients] = await Promise.all([
    listApplications(ctx, filters, page),
    getViewerTimeZone(),
    canViewClients ? listClientOptions() : [],
  ]);
  const canViewCaseFiles = ctx.can(PERMISSIONS.CASE_FILE_VIEW);

  redirectPastLastPage("/admin/applications", params, page, DEFAULT_PAGE_SIZE, total);
  return (
    <>
      <PageHeader title="Applications" description="All submitted applications for jobs you can access." />
      <LiveSearchForm className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input name="q" defaultValue={filters.q} placeholder={canViewClients ? "Application ID, candidate, job title, client" : "Application ID, candidate, job title"} className="min-w-56 flex-1" aria-label="Search applications" />
        <Input name="job" defaultValue={filters.job} placeholder="Job ID" className="w-36" aria-label="Job ID" />
        {canViewClients && (
          <Select name="client" defaultValue={filters.client ?? ""} className="w-44" aria-label="Client">
            <option value="">All clients</option>
            <option value="none">No client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.isActive ? c.name : `${c.name} (inactive)`}</option>)}
          </Select>
        )}
        <Select name="status" defaultValue={filters.status ?? ""} className="w-40" aria-label="Status">
          <option value="">All statuses</option>
          {toOptions(APPLICATION_STATUS_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </LiveSearchForm>
      {rows.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table className="[&_td]:px-3 [&_th]:px-3">
            <THead>
              <TR>
                <TH>Application ID</TH>
                <TH className="hidden sm:table-cell">Candidate</TH>
                <TH className="hidden md:table-cell">Job</TH>
                {canViewClients && <TH className="hidden xl:table-cell">Client</TH>}
                <TH className="hidden min-[87.5rem]:table-cell">Case file / folder</TH>
                <TH className="hidden xl:table-cell">Applied</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((a) => (
                <TR key={a.id}>
                  <TD className="whitespace-nowrap">
                    <Link href={`/admin/applications/${a.displayId}`} className="font-medium hover:underline">{a.displayId}</Link>
                    {/* On narrow screens the hidden Candidate / Job columns are summarised here. */}
                    <span className="block max-w-44 truncate text-xs sm:hidden" title={fullName(a.candidate)}>{fullName(a.candidate)}</span>
                    <span className="block max-w-44 truncate text-xs text-muted-foreground md:hidden" title={a.job.title}>{a.job.title}{a.job.client && <> · {a.job.client.name}</>}</span>
                  </TD>
                  <TD className="hidden whitespace-nowrap sm:table-cell">
                    <span className="flex items-center gap-2.5"><Avatar name={fullName(a.candidate)} size="xs" /><span className="max-w-40 truncate" title={fullName(a.candidate)}>{fullName(a.candidate)}</span></span>
                  </TD>
                  <TD className="hidden max-w-52 md:table-cell">
                    <Link href={`/admin/jobs/${a.job.displayId}`} className="block truncate hover:underline" title={a.job.title}>{a.job.title}</Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.job.displayId}
                      {/* The Client column is hidden below xl, so show the client here. */}
                      {a.job.client && <span className="xl:hidden" title={a.job.client.name}> · {a.job.client.name}</span>}
                    </p>
                  </TD>
                  {canViewClients && (
                    <TD className="hidden xl:table-cell">
                      {a.job.client ? <span className="block max-w-40 truncate whitespace-nowrap" title={a.job.client.name}>{a.job.client.name}</span> : <span className="text-muted-foreground">—</span>}
                    </TD>
                  )}
                  <TD className="hidden whitespace-nowrap text-xs min-[87.5rem]:table-cell">
                    {canViewCaseFiles ? (
                      <Link href={`/admin/case-files/${a.job.displayId}`} className="inline-flex items-center gap-1 hover:underline">
                        <FolderOpen className="size-3.5" aria-hidden />{a.job.caseFile?.displayId}
                      </Link>
                    ) : a.job.caseFile?.displayId}
                    <p className="text-muted-foreground">{a.folder?.displayId}</p>
                  </TD>
                  <TD className="hidden whitespace-nowrap xl:table-cell">
                    {formatDate(a.appliedAt, tz)}
                    <p className="text-xs text-muted-foreground">{SOURCE_LABELS[a.source]}</p>
                  </TD>
                  <TD className="whitespace-nowrap"><ApplicationStatusBadge status={a.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={<ClipboardList />} title="No applications found" />
      )}
      <Pagination basePath="/admin/applications" params={params} page={page} pageSize={DEFAULT_PAGE_SIZE} total={total} />
    </>
  );
}
