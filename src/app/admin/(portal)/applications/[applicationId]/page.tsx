import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailList, TagList } from "@/components/shared/detail-list";
import { Avatar } from "@/components/shared/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { DocumentList } from "@/components/documents/document-list";
import { AssignRecruiterForm, NoteForm, StatusUpdateForm } from "@/components/admin/application-controls";
import {
  APPLICATION_STATUS_LABELS,
  COMPENSATION_TYPE_LABELS,
  COUNTRY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  QUALIFICATION_LABELS,
  SOURCE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  WORK_AUTH_STATUS_LABELS,
} from "@/config/options";
import { formatLocation } from "@/config/locations";
import { formatCalendarDate, formatDateTime, formatMoney, formatPhone, formatYears, fullName } from "@/lib/format";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { getApplicationFolder, listActiveStaff } from "@/modules/applications/queries";
import { candidateFacingStatus } from "@/modules/applications/status";
import { parseSnapshot } from "@/modules/candidates/snapshot";

export const metadata: Metadata = { title: "Application" };

function label<T extends string>(labels: Record<T, string>, v: string | null | undefined) {
  return v ? (labels[v as T] ?? v) : null;
}

/** Application folder: candidate, submitted snapshot, documents, status, notes and history. */
export default async function ApplicationFolderPage({ params, searchParams }: { params: Promise<{ applicationId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.APPLICATION_VIEW);
  // Independent lookups run together (the staff list doesn't depend on the application).
  const [app, tz, staff] = await Promise.all([
    getApplicationFolder(ctx, (await params).applicationId.toUpperCase()),
    getViewerTimeZone(),
    listActiveStaff(),
  ]);
  if (!app) notFound();
  const notice = param(await searchParams, "notice");
  const snap = parseSnapshot(app.candidateSnapshot);
  const canUpdate = ctx.can(PERMISSIONS.APPLICATION_UPDATE_STATUS);
  const canAssign = ctx.can(PERMISSIONS.APPLICATION_ASSIGN);
  const canNote = ctx.can(PERMISSIONS.APPLICATION_NOTE);
  const c = app.candidate;

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3"><Avatar name={fullName(c)} size="md" />{fullName(c)} <ApplicationStatusBadge status={app.status} /><span className="text-base font-normal text-muted-foreground">{app.displayId}</span></span>}
        description={
          <>
            <Link href={`/admin/jobs/${app.job.displayId}`} className="hover:underline">{app.job.displayId} — {app.job.title}</Link> ·{" "}
            {ctx.can(PERMISSIONS.CASE_FILE_VIEW) ? <Link href={`/admin/case-files/${app.job.displayId}`} className="hover:underline">Case file {app.job.caseFile?.displayId}</Link> : <>Case file {app.job.caseFile?.displayId}</>} · Folder {app.folder?.displayId}
          </>
        }
        back={{ href: ctx.can(PERMISSIONS.CASE_FILE_VIEW) ? `/admin/case-files/${app.job.displayId}` : "/admin/applications", label: "Back" }}
      />
      {notice === "created" && <Alert variant="success" className="mb-4">Application {app.displayId} created and filed in case file {app.job.caseFile?.displayId}.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><CardTitle>Application details</CardTitle></CardHeader>
            <CardContent>
              <DetailList columns={3} items={[
                { label: "Application ID", value: app.displayId },
                { label: "Applied", value: formatDateTime(app.appliedAt, tz) },
                { label: "Source", value: SOURCE_LABELS[app.source] },
                { label: "Relevant experience", value: app.relevantExperienceYears != null ? formatYears(app.relevantExperienceYears) : null },
                { label: "Availability at application", value: app.availability },
                { label: "Work authorization response", value: app.workAuthorizationResponse },
                { label: "Candidate sees status", value: candidateFacingStatus(app.status) },
                { label: "Last updated", value: formatDateTime(app.updatedAt, tz) },
                { label: "Assigned recruiter", value: app.assignedRecruiter ? fullName(app.assignedRecruiter) : "Unassigned" },
                { label: "Experience summary", value: app.relevantExperienceSummary && <span className="prose-text">{app.relevantExperienceSummary}</span>, wide: true },
                { label: "Candidate comments", value: app.additionalComments && <span className="prose-text">{app.additionalComments}</span>, wide: true },
                ...(app.consentBasis ? [{ label: "Consent / representation basis", value: `${app.consentBasis} — recorded ${formatDateTime(app.consentRecordedAt, tz)}${app.consentRecordedBy ? ` by ${fullName(app.consentRecordedBy)}` : ""}`, wide: true }] : []),
              ]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Documents submitted</CardTitle><CardDescription>Copies stored with this application.</CardDescription></CardHeader>
            <CardContent><DocumentList documents={app.documents} canOpen={ctx.can(PERMISSIONS.DOCUMENT_VIEW)} /></CardContent>
          </Card>

          {snap && (
            <Card>
              <CardHeader>
                <CardTitle>Candidate profile as submitted</CardTitle>
                <CardDescription>Snapshot captured {formatDateTime(snap.capturedAt, tz)}. Later profile changes do not alter it.</CardDescription>
              </CardHeader>
              <CardContent>
                <DetailList columns={3} items={[
                  { label: "Name", value: `${snap.firstName} ${snap.lastName}` },
                  { label: "Email", value: snap.email },
                  { label: "Phone", value: formatPhone(snap.phone) },
                  { label: "Location", value: formatLocation(snap.city, snap.state, snap.country) },
                  { label: "Professional title", value: snap.professionalTitle },
                  { label: "Current title / employer", value: [snap.currentTitle, snap.currentEmployer].filter(Boolean).join(" at ") },
                  { label: "Total experience", value: formatYears(snap.totalExperienceYears) },
                  { label: "Relevant experience", value: formatYears(snap.relevantExperienceYears) },
                  { label: "Highest qualification", value: label(QUALIFICATION_LABELS, snap.highestQualification) },
                  { label: "Primary skills", value: <TagList items={snap.primarySkills} />, wide: true },
                  { label: "Secondary skills", value: <TagList items={snap.secondarySkills} />, wide: true },
                  { label: "Certifications", value: <TagList items={snap.certifications} />, wide: true },
                  { label: "Expected compensation", value: snap.expectedCompensation != null && snap.currency ? `${formatMoney(snap.expectedCompensation, snap.currency as "USD" | "CAD")} · ${label(COMPENSATION_TYPE_LABELS, snap.compensationType) ?? ""}` : null },
                  { label: "Notice period", value: snap.noticePeriodDays != null ? `${snap.noticePeriodDays} days` : null },
                  { label: "Available from", value: snap.availableFrom ? formatCalendarDate(snap.availableFrom) : null },
                  { label: "Work authorization", value: snap.workAuthStatus ? `${label(COUNTRY_LABELS, snap.workAuthCountry) ?? ""} ${label(WORK_AUTH_STATUS_LABELS, snap.workAuthStatus)}` : null },
                  { label: "Preferred arrangements", value: snap.preferredWorkArrangements.map((v) => label(WORK_ARRANGEMENT_LABELS, v)).join(", ") },
                  { label: "Preferred employment", value: snap.preferredEmploymentTypes.map((v) => label(EMPLOYMENT_TYPE_LABELS, v)).join(", ") },
                  { label: "Resume submitted", value: snap.resume?.fileName },
                ]} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Internal recruiter notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canNote && <NoteForm applicationId={app.id} />}
              {app.notes.length ? (
                <ul className="space-y-3">
                  {app.notes.map((n) => (
                    <li key={n.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="prose-text">{n.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{n.author ? fullName(n.author) : "Former user"} · {formatDateTime(n.createdAt, tz)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No notes yet.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {(canUpdate || canAssign) && (
            <Card>
              <CardHeader><CardTitle>Status</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {canUpdate ? <StatusUpdateForm applicationId={app.id} status={app.status} /> : <div className="text-sm">Current: <ApplicationStatusBadge status={app.status} /></div>}
                {canAssign && <AssignRecruiterForm applicationId={app.id} current={app.assignedRecruiter?.id ?? ""} staff={staff.map((s) => ({ id: s.id, name: fullName(s) }))} />}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Candidate (current)</CardTitle>
              {ctx.can(PERMISSIONS.CANDIDATE_VIEW) && <Link href={`/admin/candidates/${c.displayId}`} className="text-sm underline">Profile</Link>}
            </CardHeader>
            <CardContent>
              <DetailList columns={1} items={[
                { label: "Candidate ID", value: c.displayId },
                { label: "Email", value: c.email },
                { label: "Phone", value: formatPhone(c.phone) },
                { label: "Location", value: formatLocation(c.city, c.state, c.country) },
                { label: "Source", value: <Badge tone="outline">{SOURCE_LABELS[c.source]}</Badge> },
                { label: "LinkedIn", value: c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline">Open profile ↗</a> },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Status history</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l pl-4">
                {app.statusHistory.map((h) => (
                  <li key={h.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
                    <p className="font-medium">{h.fromStatus ? `${APPLICATION_STATUS_LABELS[h.fromStatus]} → ` : ""}{APPLICATION_STATUS_LABELS[h.toStatus]}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.changedAt, tz)} · {h.changedBy ? fullName(h.changedBy) : "Candidate"}</p>
                    {h.note && <p className="mt-0.5 text-xs">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
