import type { Metadata } from "next";
import Link from "next/link";
import type { JobStatus } from "@prisma/client";
import { Briefcase, FolderOpen } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { JobStatusBadge } from "@/components/shared/status-badges";
import { JOB_STATUS_LABELS, toOptions } from "@/config/options";
import { formatDate, fullName } from "@/lib/format";
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
  const filters = { q: param(params, "q"), status, mine: param(params, "mine") === "1" };
  const [{ total, jobs }, tz] = await Promise.all([listAdminJobs(ctx, filters, page), getViewerTimeZone()]);

  return (
    <>
      <PageHeader
        title="Jobs"
        description={ctx.can(PERMISSIONS.JOB_VIEW_ALL) ? "All job requirements." : "Jobs assigned to you or your groups."}
        actions={ctx.can(PERMISSIONS.JOB_CREATE) && <Link href="/admin/jobs/new" className={buttonVariants()}>Create job</Link>}
      />
      <LiveSearchForm className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input name="q" defaultValue={filters.q} placeholder="Job ID, title or city" className="max-w-xs" aria-label="Search jobs" />
        <Select name="status" defaultValue={status ?? ""} className="w-40" aria-label="Status">
          <option value="">All statuses</option>
          {toOptions(JOB_STATUS_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm"><Checkbox name="mine" value="1" defaultChecked={filters.mine} /> Assigned to me</label>
        <Button type="submit" variant="outline">Filter</Button>
      </LiveSearchForm>
      {jobs.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table>
            <THead><TR><TH>Job ID</TH><TH>Title</TH><TH>Location</TH><TH>Recruiter</TH><TH>Status</TH><TH>Posted</TH><TH>Case file</TH><TH className="text-right">Apps</TH></TR></THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={j.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{j.displayId}</TD>
                  <TD><Link href={`/admin/jobs/${j.displayId}`} className="font-medium hover:underline">{j.title}</Link></TD>
                  <TD className="whitespace-nowrap">{j.city}, {j.state}</TD>
                  <TD>{j.assignedRecruiter ? fullName(j.assignedRecruiter) : "—"}</TD>
                  <TD><JobStatusBadge status={j.status} /></TD>
                  <TD className="whitespace-nowrap">{j.publishedAt ? formatDate(j.publishedAt, tz) : "—"}</TD>
                  <TD className="whitespace-nowrap">
                    {ctx.can(PERMISSIONS.CASE_FILE_VIEW) ? (
                      <Link href={`/admin/case-files/${j.displayId}`} className="inline-flex items-center gap-1 hover:underline">
                        <FolderOpen className="size-3.5 text-muted-foreground" aria-hidden />{j.caseFile?.displayId}
                      </Link>
                    ) : j.caseFile?.displayId}
                  </TD>
                  <TD className="text-right tabular-nums">{j._count.applications}</TD>
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
