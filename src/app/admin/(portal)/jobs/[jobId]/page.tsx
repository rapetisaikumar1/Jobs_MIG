import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DetailList, TagList } from "@/components/shared/detail-list";
import { Avatar } from "@/components/shared/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationStatusBadge, JobStatusBadge } from "@/components/shared/status-badges";
import { JobStatusActions } from "@/components/admin/job-status-actions";
import { COMPENSATION_TYPE_LABELS, EMPLOYMENT_TYPE_LABELS, SOURCE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import {
  decimalToNumber,
  formatCalendarDate,
  formatCompensation,
  formatDate,
  formatDateTime,
  formatExperienceRange,
  fullName,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { getAdminJob } from "@/modules/jobs/queries";
import { allowedJobActions } from "@/modules/jobs/service";

export const metadata: Metadata = { title: "Job" };

export default async function AdminJobPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff();
  const job = await getAdminJob(ctx, (await params).jobId);
  if (!job) notFound();
  const notice = param(await searchParams, "notice");
  const tz = await getViewerTimeZone();

  const applications = ctx.can(PERMISSIONS.APPLICATION_VIEW)
    ? await prisma.application.findMany({
        where: { jobId: job.id },
        orderBy: { appliedAt: "desc" },
        take: 100,
        select: {
          displayId: true, status: true, source: true, appliedAt: true,
          candidate: { select: { displayId: true, firstName: true, lastName: true } },
          assignedRecruiter: { select: { firstName: true, lastName: true } },
        },
      })
    : [];

  const actions = allowedJobActions(job.status).filter((a) =>
    a === "publish" || a === "reopen" ? ctx.can(PERMISSIONS.JOB_PUBLISH) : ctx.can(PERMISSIONS.JOB_CLOSE),
  );
  const pay = formatCompensation(decimalToNumber(job.compensationMin), decimalToNumber(job.compensationMax), job.currency, job.compensationType);
  const required = job.skills.filter((s) => s.type === "REQUIRED").map((s) => s.skill.name);
  const preferred = job.skills.filter((s) => s.type === "PREFERRED").map((s) => s.skill.name);

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{job.title} <JobStatusBadge status={job.status} />{job.isFeatured && <Badge tone="dark">Featured</Badge>}</span>}
        description={<>{job.displayId} · Case file {job.caseFile?.displayId}</>}
        back={{ href: "/admin/jobs", label: "Jobs" }}
        actions={
          <>
            {ctx.can(PERMISSIONS.CASE_FILE_VIEW) && (
              <Link href={`/admin/case-files/${job.displayId}`} className={buttonVariants({ variant: "outline" })}><FolderOpen aria-hidden /> Case file ({job.caseFile?._count.folders ?? 0})</Link>
            )}
            {ctx.can(PERMISSIONS.CANDIDATE_ADD) && (job.status === "DRAFT" || job.status === "PUBLISHED") && (
              <Link href={`/admin/jobs/${job.displayId}/add-candidate`} className={buttonVariants({ variant: "outline" })}><UserPlus aria-hidden /> Add existing candidate</Link>
            )}
            {ctx.can(PERMISSIONS.JOB_EDIT) && <Link href={`/admin/jobs/${job.displayId}/edit`} className={buttonVariants({ variant: "outline" })}>Edit</Link>}
            <JobStatusActions jobId={job.id} actions={actions} />
          </>
        }
      />
      {notice === "created" && <Alert variant="success" className="mb-4">Job {job.displayId} created as a draft with case file {job.caseFile?.displayId}. Publish it to show it on the job portal.</Alert>}
      {notice === "updated" && <Alert variant="success" className="mb-4">Job updated.</Alert>}

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
                  <Table>
                    <THead><TR><TH>Application</TH><TH>Candidate</TH><TH>Applied</TH><TH>Source</TH><TH>Recruiter</TH><TH>Status</TH></TR></THead>
                    <TBody>
                      {applications.map((a) => (
                        <TR key={a.displayId}>
                          <TD className="whitespace-nowrap"><Link href={`/admin/applications/${a.displayId}`} className="font-medium hover:underline">{a.displayId}</Link></TD>
                          <TD className="whitespace-nowrap"><span className="flex items-center gap-2.5"><Avatar name={fullName(a.candidate)} size="xs" />{fullName(a.candidate)}</span></TD>
                          <TD className="whitespace-nowrap">{formatDate(a.appliedAt, tz)}</TD>
                          <TD>{SOURCE_LABELS[a.source]}</TD>
                          <TD>{a.assignedRecruiter ? fullName(a.assignedRecruiter) : "—"}</TD>
                          <TD><ApplicationStatusBadge status={a.status} /></TD>
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
                { label: "Location", value: formatLocation(job.city, job.state, job.country) },
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
            <CardHeader><CardTitle>Internal</CardTitle></CardHeader>
            <CardContent>
              <DetailList columns={1} items={[
                { label: "Assigned recruiter", value: job.assignedRecruiter ? fullName(job.assignedRecruiter) : "Unassigned" },
                { label: "Groups", value: job.groups.length ? job.groups.map((g) => g.group.name).join(", ") : null },
                { label: "Internal notes", value: job.internalNotes && <span className="prose-text">{job.internalNotes}</span> },
                { label: "Created", value: `${formatDateTime(job.createdAt, tz)} by ${fullName(job.createdBy)}` },
                { label: "Posted (first published)", value: job.publishedAt ? formatDateTime(job.publishedAt, tz) : "Not yet published" },
                ...(job.closedAt ? [{ label: "Closed", value: formatDateTime(job.closedAt, tz) }] : []),
              ]} />
              {job.status === "PUBLISHED" && <Link href={`/jobs/${job.displayId}`} target="_blank" className="mt-4 inline-block text-sm underline">View public posting ↗</Link>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
