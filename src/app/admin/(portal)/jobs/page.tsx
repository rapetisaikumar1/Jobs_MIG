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
import { formatRegionNames, jobStates } from "@/config/locations";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, param, parsePage, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listAdminJobs } from "@/modules/jobs/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Jobs" };

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff();
  const params = await searchParams;
  const page = parsePage(params.page);
  const statusParam = param(params, "status");
  const status = statusParam && statusParam in JOB_STATUS_LABELS ? (statusParam as JobStatus) : undefined;
  const filters = { q: param(params, "q"), status };
  const [{ total, jobs }, tz] = await Promise.all([listAdminJobs(ctx, filters, page), getViewerTimeZone()]);

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
        <Button type="submit" variant="outline">Filter</Button>
      </LiveSearchForm>
      {jobs.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table className="[&_td]:px-3 [&_th]:px-3">
            <THead>
              <TR>
                <TH className="hidden sm:table-cell">Job ID</TH>
                <TH>Title</TH>
                <TH className="hidden md:table-cell">Location</TH>
                <TH>Status</TH>
                <TH className="hidden xl:table-cell">Posted</TH>
                <TH className="hidden min-[87.5rem]:table-cell">Case file</TH>
                <TH className="hidden text-right sm:table-cell">Apps</TH>
              </TR>
            </THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={j.id}>
                  <TD className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{j.displayId}</TD>
                  <TD className="min-w-40">
                    <Link href={`/admin/jobs/${j.displayId}`} className="block max-w-md font-medium [overflow-wrap:anywhere] hover:underline">{j.title}</Link>
                    <span className="block text-xs text-muted-foreground sm:hidden">{j.displayId} · {j._count.applications} app{j._count.applications === 1 ? "" : "s"}</span>
                  </TD>
                  <TD className="hidden max-w-56 truncate whitespace-nowrap md:table-cell" title={formatRegionNames(j.country, jobStates(j))}>{[j.city, jobStates(j).join(", ")].filter(Boolean).join(", ")}</TD>
                  <TD className="whitespace-nowrap"><JobStatusBadge status={j.status} /></TD>
                  <TD className="hidden whitespace-nowrap xl:table-cell">{j.publishedAt ? formatDate(j.publishedAt, tz) : "—"}</TD>
                  <TD className="hidden whitespace-nowrap min-[87.5rem]:table-cell">
                    {ctx.can(PERMISSIONS.CASE_FILE_VIEW) ? (
                      <Link href={`/admin/case-files/${j.displayId}`} className="inline-flex items-center gap-1 hover:underline">
                        <FolderOpen className="size-3.5 text-muted-foreground" aria-hidden />{j.caseFile?.displayId}
                      </Link>
                    ) : j.caseFile?.displayId}
                  </TD>
                  <TD className="hidden text-right tabular-nums sm:table-cell">{j._count.applications}</TD>
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
