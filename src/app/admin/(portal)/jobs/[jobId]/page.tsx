import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, Link2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DetailList, TagList } from "@/components/shared/detail-list";
import { Avatar } from "@/components/shared/avatar";
import { FlashNotice } from "@/components/shared/flash-notice";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationStatusBadge, JobStatusBadge } from "@/components/shared/status-badges";
import { JobStatusActions } from "@/components/admin/job-status-actions";
import { CopyJobLink } from "@/components/admin/copy-job-link";
import { COMPENSATION_TYPE_LABELS, EMPLOYMENT_TYPE_LABELS, SOURCE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { formatJobPlace, formatRegionNames, jobStates } from "@/config/locations";
import {
  decimalToNumber,
  formatCalendarDate,
  formatCompensation,
  formatDate,
  formatDateTime,
  formatExperienceRange,
  fullName,
  isDeadlinePassed,
} from "@/lib/format";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { jobScopeWhere } from "@/modules/access-control/scope";
import { getAdminJob } from "@/modules/jobs/queries";
import { allowedJobActions } from "@/modules/jobs/service";

export const metadata: Metadata = { title: "Job" };

export default async function AdminJobPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff();
  const displayId = (await params).jobId.toUpperCase();
  // The job's applications are fetched alongside the job itself. Same rows as filtering by the
  // job's id after the scoped lookup: the job is matched by display ID within the staff scope.
  const [job, tz, applications] = await Promise.all([
    getAdminJob(ctx, displayId),
    getViewerTimeZone(),
    ctx.can(PERMISSIONS.APPLICATION_VIEW)
      ? prisma.application.findMany({
        where: { job: { AND: [{ displayId }, jobScopeWhere(ctx)] } },
        orderBy: { appliedAt: "desc" },
        take: 100,
        select: {
          displayId: true, status: true, source: true, appliedAt: true,
          candidate: { select: { displayId: true, firstName: true, lastName: true } },
        },
      })
      : Promise.resolve([]),
  ]);
  if (!job) notFound();
  const notice = param(await searchParams, "notice");

  const actions = allowedJobActions(job.status).filter((a) =>
    a === "publish" || a === "reopen" ? ctx.can(PERMISSIONS.JOB_PUBLISH) : ctx.can(PERMISSIONS.JOB_CLOSE),
  );
  const pay = formatCompensation(decimalToNumber(job.compensationMin), decimalToNumber(job.compensationMax), job.currency, job.compensationType);
  const required = job.skills.filter((s) => s.type === "REQUIRED").map((s) => s.skill.name);
  const preferred = job.skills.filter((s) => s.type === "PREFERRED").map((s) => s.skill.name);
  // Remote jobs have no city or state (older rows may still hold one; it is not shown).
  const remote = job.workArrangement === "REMOTE";
  const states = remote ? [] : jobStates(job);
  // The public job page is addressed by the Job ID (canonical upper-case form).
  const publicUrl = `${serverEnv.siteUrl}/jobs/${job.displayId}`;
  const deadlinePassed = isDeadlinePassed(job.applicationDeadline);

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{job.title} <JobStatusBadge status={job.status} /></span>}
        description={<>{job.displayId} · Case file {job.caseFile?.displayId}</>}
        back={{ href: "/admin/jobs", label: "Jobs" }}
        actions={
          <>
            {ctx.can(PERMISSIONS.CASE_FILE_VIEW) && (
              <Link href={`/admin/case-files/${job.displayId}`} className={buttonVariants({ variant: "outline" })}><FolderOpen aria-hidden /> Case file ({job.caseFile?._count.folders ?? 0})</Link>
            )}
            {ctx.can(PERMISSIONS.JOB_EDIT) && <Link href={`/admin/jobs/${job.displayId}/edit`} className={buttonVariants({ variant: "outline" })}>Edit</Link>}
            <JobStatusActions jobId={job.id} actions={actions} />
          </>
        }
      />
      {notice === "created" && <FlashNotice><Alert variant="success" className="mb-4">Job {job.displayId} created as a draft with case file {job.caseFile?.displayId}. Publish it to show it on the job portal and get a shareable link for candidates.</Alert></FlashNotice>}
      {notice === "updated" && <FlashNotice><Alert variant="success" className="mb-4">Job updated.</Alert></FlashNotice>}

      <Card className="mb-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-4 text-muted-foreground" aria-hidden /> Shareable job link</CardTitle></CardHeader>
        <CardContent>
          {job.status === "PUBLISHED" ? (
            <CopyJobLink
              url={publicUrl}
              hint={deadlinePassed
                ? "The application deadline has passed: candidates who open this link can view the job but cannot apply."
                : "Send this link to candidates. They can view the job and apply after signing in or creating an account."}
            />
          ) : job.status === "CLOSED" ? (
            <CopyJobLink url={publicUrl} hint="This job is closed: candidates who open this link can view it but cannot apply. Re-open the job to accept applications again." />
          ) : job.status === "DRAFT" ? (
            <p className="text-sm text-muted-foreground">Publish this job to get a shareable link for candidates.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Archived jobs are not shown on the job portal, so there is no shareable link.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div className="prose-text">{job.description}</div>
              {job.responsibilities && (
                <div>
                  <h3 className="mb-2 font-semibold">Responsibilities</h3>
                  <ul className="space-y-1.5">
                    {job.responsibilities.split(/\n+/).map((l) => l.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean).map((item, i) => (
                      <li key={i} className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" aria-hidden />{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><h3 className="mb-2 font-semibold">Required skills</h3><TagList items={required} /></div>
                <div><h3 className="mb-2 font-semibold">Preferred skills</h3><TagList items={preferred} /></div>
              </div>
            </CardContent>
          </Card>
          {ctx.can(PERMISSIONS.APPLICATION_VIEW) && (
            <Card>
              <CardHeader><CardTitle>Applications ({applications.length})</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                {applications.length ? (
                  // Compact cells; secondary columns drop out on narrow screens (and in the narrow
                  // left column at xl) so Status always stays in view.
                  <Table className="[&_td]:px-3 [&_th]:px-3 [&_tr>*:first-child]:pl-5 [&_tr>*:last-child]:pr-5">
                    <THead>
                      <TR>
                        <TH>Application</TH>
                        <TH className="hidden sm:table-cell">Candidate</TH>
                        <TH className="hidden sm:table-cell">Applied</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {applications.map((a) => (
                        <TR key={a.displayId}>
                          <TD className="whitespace-nowrap">
                            <Link href={`/admin/applications/${a.displayId}`} className="font-medium hover:underline">{a.displayId}</Link>
                            <span className="block max-w-40 truncate text-xs text-muted-foreground sm:hidden" title={fullName(a.candidate)}>{fullName(a.candidate)}</span>
                          </TD>
                          <TD className="hidden sm:table-cell">
                            <span className="flex items-center gap-2.5"><Avatar name={fullName(a.candidate)} size="xs" /><span className="max-w-40 truncate" title={fullName(a.candidate)}>{fullName(a.candidate)}</span></span>
                          </TD>
                          <TD className="hidden whitespace-nowrap sm:table-cell">
                            {formatDate(a.appliedAt, tz)}
                            <span className="block text-xs text-muted-foreground">{SOURCE_LABELS[a.source]}</span>
                          </TD>
                          <TD className="whitespace-nowrap"><ApplicationStatusBadge status={a.status} /></TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                ) : <p className="px-5 pb-5 text-sm text-muted-foreground">No applications yet.</p>}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Employment details</CardTitle></CardHeader>
            <CardContent>
              <DetailList columns={1} items={[
                { label: "Location", value: formatJobPlace(job) },
                ...(states.length > 1 ? [{ label: "States / Provinces", value: formatRegionNames(job.country, states) }] : []),
                { label: "Work arrangement", value: WORK_ARRANGEMENT_LABELS[job.workArrangement] },
                { label: "Employment type", value: EMPLOYMENT_TYPE_LABELS[job.employmentType] },
                { label: "Experience", value: formatExperienceRange(job.minExperience, job.maxExperience) },
                { label: "Education", value: job.education },
                { label: COMPENSATION_TYPE_LABELS[job.compensationType], value: pay ? <>{pay} <Badge tone={job.salaryPublic ? "success" : "muted"}>{job.salaryPublic ? "Public" : "Internal"}</Badge></> : null },
                { label: "Application deadline", value: job.applicationDeadline ? formatCalendarDate(job.applicationDeadline) : "Open until filled" },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Record</CardTitle></CardHeader>
            <CardContent>
              <DetailList columns={1} items={[
                // Internal only; getAdminJob returns the client only to staff who may view clients.
                ...(ctx.can(PERMISSIONS.CLIENT_VIEW)
                  ? [{
                    label: "Client",
                    value: job.client ? (
                      <Link href={`/admin/clients/${job.client.id}`} className="hover:underline">
                        {job.client.name}{!job.client.isActive && <span className="text-muted-foreground"> (inactive)</span>}
                      </Link>
                    ) : "No client",
                  }]
                  : []),
                { label: "Created", value: `${formatDateTime(job.createdAt, tz)} by ${fullName(job.createdBy)}` },
                { label: "Posted (first published)", value: job.publishedAt ? formatDateTime(job.publishedAt, tz) : "Not yet published" },
                ...(job.closedAt ? [{ label: "Closed", value: formatDateTime(job.closedAt, tz) }] : []),
              ]} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
