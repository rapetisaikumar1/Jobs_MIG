import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DetailList, TagList } from "@/components/shared/detail-list";
import { Avatar } from "@/components/shared/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { ProfileDocuments } from "@/components/documents/profile-documents";
import { DocumentList } from "@/components/documents/document-list";
import {
  COMPENSATION_TYPE_LABELS,
  COUNTRY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  QUALIFICATION_LABELS,
  SOURCE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  WORK_AUTH_STATUS_LABELS,
} from "@/config/options";
import { formatLocation } from "@/config/locations";
import { decimalToNumber, formatCalendarDate, formatDate, formatDateTime, formatMoney, formatPhone, formatYears, fullName } from "@/lib/format";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { getCandidateForStaff } from "@/modules/candidates/queries";

export const metadata: Metadata = { title: "Candidate" };

export default async function CandidatePage({ params, searchParams }: { params: Promise<{ candidateId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CANDIDATE_VIEW);
  const c = await getCandidateForStaff(ctx, (await params).candidateId);
  if (!c) notFound();
  const tz = await getViewerTimeZone();
  const notice = param(await searchParams, "notice");
  const primary = c.skills.filter((s) => s.level === "PRIMARY").map((s) => s.skill.name);
  const secondary = c.skills.filter((s) => s.level === "SECONDARY").map((s) => s.skill.name);
  const comp = decimalToNumber(c.expectedCompensation);
  const docs = c.documents.map((d) => ({ id: d.id, type: d.type, fileName: d.fileName, sizeBytes: d.sizeBytes, mimeType: d.mimeType }));

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3"><Avatar name={fullName(c)} size="md" />{fullName(c)} <Badge tone={c.source === "JOB_PORTAL" ? "info" : "outline"}>{SOURCE_LABELS[c.source]}</Badge>{c.userId && <Badge tone="muted">Portal account</Badge>}</span>}
        description={`${c.displayId} · ${c.currentTitle ?? c.professionalTitle ?? "No title"} · Updated ${formatDate(c.updatedAt, tz)}`}
        back={{ href: "/admin/candidates", label: "Candidates" }}
        actions={
          <>
            {c.defaultResumeId && <a href={`/api/documents/${c.defaultResumeId}?inline=1`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>Open resume</a>}
            {ctx.can(PERMISSIONS.CANDIDATE_EDIT) && <Link href={`/admin/candidates/${c.displayId}/edit`} className={buttonVariants({ variant: "outline" })}>Edit</Link>}
            {ctx.can(PERMISSIONS.CANDIDATE_ADD) && <Link href={`/admin/candidates/${c.displayId}/add-to-job`} className={buttonVariants()}>Add to job</Link>}
          </>
        }
      />
      {notice === "created" && <Alert variant="success" className="mb-4">Candidate {c.displayId} created. They are now searchable and can be added to jobs.</Alert>}
      {notice === "updated" && <Alert variant="success" className="mb-4">Candidate updated.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent>
              <DetailList columns={3} items={[
                { label: "Email", value: <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a> },
                { label: "Phone", value: formatPhone(c.phone) },
                { label: "Alternate phone", value: c.alternatePhone && formatPhone(c.alternatePhone) },
                { label: "Location", value: formatLocation(c.city, c.state, c.country) },
                { label: "Postal code", value: c.postalCode },
                { label: "LinkedIn", value: c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline">Open ↗</a> },
                { label: "Professional title", value: c.professionalTitle },
                { label: "Current title", value: c.currentTitle },
                { label: "Current employer", value: c.currentEmployer },
                { label: "Total experience", value: formatYears(c.totalExperienceYears) },
                { label: "Relevant experience", value: formatYears(c.relevantExperienceYears) },
                { label: "Highest qualification", value: c.highestQualification && QUALIFICATION_LABELS[c.highestQualification] },
                { label: "Primary skills", value: <TagList items={primary} />, wide: true },
                { label: "Secondary skills", value: <TagList items={secondary} />, wide: true },
                { label: "Education", value: c.education && <span className="prose-text">{c.education}</span>, wide: true },
                { label: "Certifications", value: <TagList items={c.certifications} />, wide: true },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Preferences &amp; availability</CardTitle></CardHeader>
            <CardContent>
              <DetailList columns={3} items={[
                { label: "Preferred titles", value: <TagList items={c.preferredJobTitles} /> },
                { label: "Preferred locations", value: <TagList items={c.preferredLocations} /> },
                { label: "Work arrangement", value: c.preferredWorkArrangements.map((v) => WORK_ARRANGEMENT_LABELS[v]).join(", ") },
                { label: "Employment type", value: c.preferredEmploymentTypes.map((v) => EMPLOYMENT_TYPE_LABELS[v]).join(", ") },
                { label: "Expected compensation", value: comp != null && c.currency ? `${formatMoney(comp, c.currency)}${c.compensationType ? ` · ${COMPENSATION_TYPE_LABELS[c.compensationType]}` : ""}` : null },
                { label: "Notice period", value: c.noticePeriodDays != null ? `${c.noticePeriodDays} days` : null },
                { label: "Available from", value: c.availableFrom && formatCalendarDate(c.availableFrom) },
                { label: "Work authorization", value: c.workAuthStatus && `${c.workAuthCountry ? COUNTRY_LABELS[c.workAuthCountry] + " — " : ""}${WORK_AUTH_STATUS_LABELS[c.workAuthStatus]}` },
              ]} />
            </CardContent>
          </Card>
          <Card id="applications">
            <CardHeader><CardTitle>Applications ({c.applications.length})</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              {c.applications.length ? (
                <Table>
                  <THead><TR><TH>Application</TH><TH>Job</TH><TH>Applied</TH><TH>Source</TH><TH>Status</TH></TR></THead>
                  <TBody>
                    {c.applications.map((a) => (
                      <TR key={a.id}>
                        <TD><Link href={`/admin/applications/${a.displayId}`} className="font-medium hover:underline">{a.displayId}</Link></TD>
                        <TD><Link href={`/admin/jobs/${a.job.displayId}`} className="hover:underline">{a.job.title}</Link><p className="text-xs text-muted-foreground">{a.job.displayId}</p></TD>
                        <TD>{formatDate(a.appliedAt, tz)}</TD>
                        <TD>{SOURCE_LABELS[a.source]}</TD>
                        <TD><ApplicationStatusBadge status={a.status} /></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              ) : <p className="px-5 pb-5 text-sm text-muted-foreground">No applications on jobs you can access.</p>}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Profile documents</CardTitle></CardHeader>
            <CardContent>
              {ctx.can(PERMISSIONS.CANDIDATE_EDIT) ? (
                <ProfileDocuments documents={docs} defaultResumeId={c.defaultResumeId} candidateId={c.id} />
              ) : (
                <DocumentList documents={docs} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recruitment (internal)</CardTitle></CardHeader>
            <CardContent>
              <DetailList columns={1} items={[
                { label: "Source", value: SOURCE_LABELS[c.source] },
                { label: "Profile owner", value: c.profileOwner ? fullName(c.profileOwner) : "Unassigned" },
                { label: "Created", value: `${formatDateTime(c.createdAt, tz)}${c.createdBy ? ` by ${fullName(c.createdBy)}` : " (job portal)"}` },
                { label: "Portal account", value: c.userId ? (c.user?.isActive ? "Active" : "Inactive") : "None (internal record)" },
                { label: "Internal notes", value: c.internalNotes && <span className="prose-text">{c.internalNotes}</span> },
              ]} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
