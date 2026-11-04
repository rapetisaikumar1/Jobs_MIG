import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DetailList, TagList } from "@/components/shared/detail-list";
import { PageHeader } from "@/components/shared/page-header";
import { AddCandidateToJobForm } from "@/components/admin/add-candidate-to-job-form";
import { COUNTRY_LABELS, SOURCE_LABELS, WORK_AUTH_STATUS_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import { formatPhone, formatYears, fullName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { param, type SearchParams } from "@/lib/pagination";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listActiveStaff } from "@/modules/applications/queries";
import { candidateListSelect, quickCandidateWhere } from "@/modules/candidates/queries";
import { getAdminJob } from "@/modules/jobs/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Add candidate to job" };

export default async function AddCandidateToJobPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.APPLICATION_CREATE);
  // These pages list and show candidates' personal details, so viewing candidates is required too.
  if (!ctx.can(PERMISSIONS.CANDIDATE_VIEW)) redirect("/admin/forbidden");
  const job = await getAdminJob(ctx, (await params).jobId);
  if (!job) notFound();
  const sp = await searchParams;
  const q = param(sp, "q")?.slice(0, 100);
  const selectedId = param(sp, "candidate");
  const base = `/admin/jobs/${job.displayId}/add-candidate`;

  if (job.status !== "DRAFT" && job.status !== "PUBLISHED") {
    return (
      <>
        <PageHeader title="Add existing candidate" back={{ href: `/admin/jobs/${job.displayId}`, label: job.displayId }} />
        <Alert variant="neutral">Candidates can only be added to draft or open jobs.</Alert>
      </>
    );
  }

  const selected = selectedId
    ? await prisma.candidateProfile.findUnique({
        where: { displayId: selectedId.toUpperCase() },
        include: {
          skills: { include: { skill: true } },
          documents: { where: { status: "ACTIVE", type: "RESUME", applicationId: null }, orderBy: { createdAt: "desc" } },
        },
      })
    : null;
  const existing = selected
    ? await prisma.application.findUnique({ where: { candidateId_jobId: { candidateId: selected.id, jobId: job.id } } })
    : null;
  const results = !selected && q
    ? await prisma.candidateProfile.findMany({ where: quickCandidateWhere(q), take: 20, orderBy: { updatedAt: "desc" }, select: candidateListSelect })
    : [];
  const staff = selected ? await listActiveStaff() : [];

  return (
    <>
      <PageHeader
        title="Add existing candidate"
        description={<>{job.displayId} — {job.title}. The candidate does not need a job portal account.</>}
        back={{ href: `/admin/jobs/${job.displayId}`, label: job.displayId }}
      />

      {!selected ? (
        <Card>
          <CardHeader><CardTitle>1. Find the candidate</CardTitle></CardHeader>
          <CardContent>
            <LiveSearchForm className="flex max-w-xl gap-2">
              <Input name="q" defaultValue={q} placeholder="Name, email, phone or Candidate ID" aria-label="Search candidates" autoFocus />
              <Button type="submit">Search</Button>
            </LiveSearchForm>
            <p className="mt-2 text-xs text-muted-foreground">
              Need more filters? Use <Link href="/admin/search" className="underline">Advanced search</Link> and choose &quot;Add to job&quot;. Candidate not in the system?{" "}
              <Link href="/admin/candidates/new" className="underline">Create a candidate</Link> first.
            </p>
            {q && (
              <div className="mt-4 rounded-lg border">
                {results.length ? (
                  <Table>
                    <THead><TR><TH>Candidate</TH><TH>Title</TH><TH>Location</TH><TH>Source</TH><TH /></TR></THead>
                    <TBody>
                      {results.map((c) => (
                        <TR key={c.id}>
                          <TD>{fullName(c)}<p className="text-xs text-muted-foreground">{c.displayId} · {c.email}</p></TD>
                          <TD>{c.currentTitle ?? c.professionalTitle ?? "—"}</TD>
                          <TD>{formatLocation(c.city, c.state, c.country)}</TD>
                          <TD>{SOURCE_LABELS[c.source]}</TD>
                          <TD className="text-right"><Link href={`${base}?candidate=${c.displayId}`} className={buttonVariants({ size: "sm" })}>Select</Link></TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                ) : <p className="p-4 text-sm text-muted-foreground">No candidates match &quot;{q}&quot;.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{fullName(selected)}</CardTitle>
              <Link href={base} className="text-sm underline">Change</Link>
            </CardHeader>
            <CardContent>
              <DetailList columns={1} items={[
                { label: "Candidate ID", value: <Link href={`/admin/candidates/${selected.displayId}`} className="hover:underline">{selected.displayId}</Link> },
                { label: "Email", value: selected.email },
                { label: "Phone", value: formatPhone(selected.phone) },
                { label: "Location", value: formatLocation(selected.city, selected.state, selected.country) },
                { label: "Current title", value: selected.currentTitle ?? selected.professionalTitle },
                { label: "Experience", value: formatYears(selected.totalExperienceYears) },
                { label: "Skills", value: <TagList items={selected.skills.map((s) => s.skill.name)} /> },
                { label: "Source", value: SOURCE_LABELS[selected.source] },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>2. Confirm details, resume and consent</CardTitle></CardHeader>
            <CardContent>
              {existing ? (
                <Alert variant="neutral">
                  This candidate already has an application for this job:{" "}
                  <Link href={`/admin/applications/${existing.displayId}`} className="underline">{existing.displayId}</Link>.
                </Alert>
              ) : (
                <AddCandidateToJobForm
                  jobId={job.id}
                  candidateId={selected.id}
                  resumes={selected.documents.map((d) => ({ id: d.id, fileName: d.fileName, sizeBytes: d.sizeBytes }))}
                  defaultResumeId={selected.defaultResumeId}
                  staff={staff.map((s) => ({ id: s.id, name: fullName(s) }))}
                  defaults={{
                    relevantExperienceYears: selected.relevantExperienceYears?.toString() ?? "",
                    availability: selected.noticePeriodDays != null ? `${selected.noticePeriodDays} days' notice` : "",
                    workAuthorizationResponse: selected.workAuthStatus
                      ? `${selected.workAuthCountry ? COUNTRY_LABELS[selected.workAuthCountry] + " — " : ""}${WORK_AUTH_STATUS_LABELS[selected.workAuthStatus]}`
                      : "",
                    assignedRecruiterId: ctx.user.id,
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
