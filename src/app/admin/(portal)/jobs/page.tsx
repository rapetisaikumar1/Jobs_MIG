import type { Metadata } from "next";
import Link from "next/link";
import type { JobStatus } from "@prisma/client";
import { Briefcase, FolderOpen } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, redirectPastLastPage } from "@/components/shared/pagination";
import { JobStatusBadge } from "@/components/shared/status-badges";
import { JOB_STATUS_LABELS, toOptions } from "@/config/options";
import { formatJobPlace, formatRegionNames, jobStates } from "@/config/locations";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, param, parsePage, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listAdminJobs, parseClientFilter } from "@/modules/jobs/queries";
import { listClientOptions } from "@/modules/clients/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";
import { CopyJobLinkButton } from "@/components/admin/copy-job-link";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Jobs" };

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff();
  const params = await searchParams;
  const page = parsePage(params.page);
  const statusParam = param(params, "status");
  const status = statusParam && statusParam in JOB_STATUS_LABELS ? (statusParam as JobStatus) : undefined;
  // Clients are internal: the Client column and filter are only for staff who may view clients.
  const canViewClients = ctx.can(PERMISSIONS.CLIENT_VIEW);
  const filters = { q: param(params, "q"), status, client: parseClientFilter(ctx, param(params, "client")) };
  const [{ total, jobs }, tz, clients] = await Promise.all([
    listAdminJobs(ctx, filters, page),
    getViewerTimeZone(),
    canViewClients ? listClientOptions() : [],
  ]);

  redirectPastLastPage("/admin/jobs", params, page, DEFAULT_PAGE_SIZE, total);
  return (
    <>
      <PageHeader
        title="Jobs"
        description={ctx.can(PERMISSIONS.JOB_VIEW_ALL) ? "All job requirements." : "Jobs you created."}
        actions={ctx.can(PERMISSIONS.JOB_CREATE) && <Link href="/admin/jobs/new" className={buttonVariants()}>Create job</Link>}
      />
      <LiveSearchForm className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input name="q" defaultValue={filters.q} placeholder="Job ID, title or city" className="max-w-xs" aria-label="Search jobs" />
        <Select name="status" defaultValue={status ?? ""} className="w-40" aria-label="Status">
          <option value="">All statuses</option>
          {toOptions(JOB_STATUS_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        {canViewClients && (
          <Select name="client" defaultValue={filters.client ?? ""} className="w-44" aria-label="Source">
            <option value="">All sources</option>
            <option value="none">No source</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.isActive ? c.name : `${c.name} (inactive)`}</option>)}
          </Select>
        )}
        <Button type="submit" variant="outline">Filter</Button>
      </LiveSearchForm>
      {jobs.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table className="[&_td]:px-3 [&_th]:px-3">
            <THead>
              <TR>
                <TH className="hidden lg:table-cell">Job ID</TH>
                <TH>Title</TH>
                {canViewClients && <TH className="hidden xl:table-cell">Source</TH>}
                <TH className="hidden lg:table-cell">Location</TH>
                <TH>Status</TH>
                <TH className="hidden xl:table-cell">Posted</TH>
                <TH className="hidden min-[100rem]:table-cell">Case file</TH>
                <TH className="hidden text-right sm:table-cell">Apps</TH>
                <TH className="text-right"><span className="sr-only">Share link</span></TH>
              </TR>
            </THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={j.id}>
                  <TD className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">{j.displayId}</TD>
                  <TD className="min-w-40">
                    <Link href={`/admin/jobs/${j.displayId}`} className="block max-w-xs font-medium [overflow-wrap:anywhere] hover:underline 2xl:max-w-md">{j.title}</Link>
                    {/* Job ID and location columns are hidden below lg; show them here instead. */}
                    <span className="block text-xs text-muted-foreground lg:hidden">
                      {j.displayId} · {j.workArrangement === "REMOTE" ? `Remote · ${formatJobPlace(j)}` : [j.city, jobStates(j).join(", ")].filter(Boolean).join(", ")}
                      <span className="sm:hidden"> · {j._count.applications} app{j._count.applications === 1 ? "" : "s"}</span>
                    </span>
                    {/* The Client column is hidden below xl, so show the client here. */}
                    {j.client && <span className="block max-w-md truncate text-xs text-muted-foreground xl:hidden" title={j.client.name}>{j.client.name}</span>}
                  </TD>
                  {canViewClients && (
                    <TD className="hidden xl:table-cell">
                      {j.client ? <span className="block max-w-44 truncate" title={j.client.name}>{j.client.name}</span> : <span className="text-muted-foreground">—</span>}
                    </TD>
                  )}
                  {j.workArrangement === "REMOTE" ? (
                    <TD className="hidden max-w-44 truncate whitespace-nowrap lg:table-cell">Remote · {formatJobPlace(j)}</TD>
                  ) : (
                    <TD className="hidden max-w-44 truncate whitespace-nowrap lg:table-cell" title={formatRegionNames(j.country, jobStates(j))}>{[j.city, jobStates(j).join(", ")].filter(Boolean).join(", ")}</TD>
                  )}
                  <TD className="whitespace-nowrap"><JobStatusBadge status={j.status} /></TD>
                  <TD className="hidden whitespace-nowrap xl:table-cell">{j.publishedAt ? formatDate(j.publishedAt, tz) : "—"}</TD>
                  <TD className="hidden whitespace-nowrap min-[100rem]:table-cell">
                    {ctx.can(PERMISSIONS.CASE_FILE_VIEW) ? (
                      <Link href={`/admin/case-files/${j.displayId}`} className="inline-flex items-center gap-1 hover:underline">
                        <FolderOpen className="size-3.5 text-muted-foreground" aria-hidden />{j.caseFile?.displayId}
                      </Link>
                    ) : j.caseFile?.displayId}
                  </TD>
                  <TD className="hidden text-right tabular-nums sm:table-cell">{j._count.applications}</TD>
                  <TD className="text-right">
                    {/* Same link and rule as the job page: only jobs on the public portal have one. */}
                    {(j.status === "PUBLISHED" || j.status === "CLOSED") && <CopyJobLinkButton url={`${serverEnv.siteUrl}/jobs/${j.displayId}`} labelClassName="hidden min-[100rem]:inline" />}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={<Briefcase />} title="No jobs found" description="Adjust the filters, or create a new job." />
      )}
      <Pagination basePath="/admin/jobs" params={params} page={page} pageSize={DEFAULT_PAGE_SIZE} total={total} />
    </>
  );
}
