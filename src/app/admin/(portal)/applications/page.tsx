import type { Metadata } from "next";
import Link from "next/link";
import type { ApplicationStatus, Source } from "@prisma/client";
import { ClipboardList, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
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
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.APPLICATION_VIEW);
  const params = await searchParams;
  const page = parsePage(params.page);
  const s = param(params, "status");
  const src = param(params, "source");
  const filters = {
    q: param(params, "q")?.slice(0, 100),
    status: s && s in APPLICATION_STATUS_LABELS ? (s as ApplicationStatus) : undefined,
    source: src && src in SOURCE_LABELS ? (src as Source) : undefined,
    job: param(params, "job")?.slice(0, 30),
    mine: param(params, "mine") === "1",
  };
  const [{ total, rows }, tz] = await Promise.all([listApplications(ctx, filters, page), getViewerTimeZone()]);
  const canViewCaseFiles = ctx.can(PERMISSIONS.CASE_FILE_VIEW);

  redirectPastLastPage("/admin/applications", params, page, DEFAULT_PAGE_SIZE, total);
  return (
    <>
      <PageHeader title="Applications" description="All submitted applications for jobs you can access." />
      <LiveSearchForm className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input name="q" defaultValue={filters.q} placeholder="Application ID, candidate, job title" className="min-w-56 flex-1" aria-label="Search applications" />
        <Input name="job" defaultValue={filters.job} placeholder="Job ID" className="w-36" aria-label="Job ID" />
        <Select name="status" defaultValue={filters.status ?? ""} className="w-40" aria-label="Status">
          <option value="">All statuses</option>
          {toOptions(APPLICATION_STATUS_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select name="source" defaultValue={filters.source ?? ""} className="w-44" aria-label="Source">
          <option value="">All sources</option>
          {toOptions(SOURCE_LABELS).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <label className="flex items-center gap-2 whitespace-nowrap px-1 text-sm"><Checkbox name="mine" value="1" defaultChecked={filters.mine} /> Assigned to me</label>
        <Button type="submit" variant="outline">Filter</Button>
      </LiveSearchForm>
      {rows.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table className="[&_td]:px-3 [&_th]:px-3">
            <THead><TR><TH>Application ID</TH><TH>Candidate</TH><TH>Job</TH><TH>Case file / folder</TH><TH>Applied</TH><TH>Recruiter</TH><TH>Status</TH></TR></THead>
            <TBody>
              {rows.map((a) => (
                <TR key={a.id}>
                  <TD className="whitespace-nowrap"><Link href={`/admin/applications/${a.displayId}`} className="font-medium hover:underline">{a.displayId}</Link></TD>
                  <TD className="whitespace-nowrap"><span className="flex items-center gap-2.5"><Avatar name={fullName(a.candidate)} size="xs" />{fullName(a.candidate)}</span></TD>
                  <TD className="max-w-52">
                    <Link href={`/admin/jobs/${a.job.displayId}`} className="block truncate hover:underline">{a.job.title}</Link>
                    <p className="text-xs text-muted-foreground">{a.job.displayId}</p>
                  </TD>
                  <TD className="whitespace-nowrap text-xs">
                    {canViewCaseFiles ? (
                      <Link href={`/admin/case-files/${a.job.displayId}`} className="inline-flex items-center gap-1 hover:underline">
                        <FolderOpen className="size-3.5" aria-hidden />{a.job.caseFile?.displayId}
                      </Link>
                    ) : a.job.caseFile?.displayId}
                    <p className="text-muted-foreground">{a.folder?.displayId}</p>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatDate(a.appliedAt, tz)}
                    <p className="text-xs text-muted-foreground">{SOURCE_LABELS[a.source]}</p>
                  </TD>
                  <TD className="whitespace-nowrap">{a.assignedRecruiter ? fullName(a.assignedRecruiter) : <span className="text-muted-foreground">Unassigned</span>}</TD>
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
