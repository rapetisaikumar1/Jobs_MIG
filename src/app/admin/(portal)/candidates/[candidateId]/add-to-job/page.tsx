import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { JobStatusBadge } from "@/components/shared/status-badges";
import { fullName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { param, type SearchParams } from "@/lib/pagination";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { jobScopeWhere } from "@/modules/access-control/scope";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Add candidate to a job" };

/** Candidate-first entry point: choose a job, then confirm on the job's add-candidate page. */
export default async function CandidateAddToJobPage({ params, searchParams }: { params: Promise<{ candidateId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CANDIDATE_ADD);
  const candidate = await prisma.candidateProfile.findUnique({
    where: { displayId: (await params).candidateId.toUpperCase() },
    select: { id: true, displayId: true, firstName: true, lastName: true, applications: { select: { jobId: true } } },
  });
  if (!candidate) notFound();
  const q = param(await searchParams, "q")?.slice(0, 100);
  const applied = new Set(candidate.applications.map((a) => a.jobId));

  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        jobScopeWhere(ctx),
        { status: { in: ["DRAFT", "PUBLISHED"] } },
        q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { displayId: { contains: q, mode: "insensitive" } }] } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, displayId: true, title: true, status: true, city: true, state: true },
  });

  return (
    <>
      <PageHeader title={`Add ${fullName(candidate)} to a job`} description={candidate.displayId} back={{ href: `/admin/candidates/${candidate.displayId}`, label: candidate.displayId }} />
      <LiveSearchForm className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input name="q" defaultValue={q} placeholder="Job title or Job ID" aria-label="Search jobs" className="max-w-md flex-1" />
        <Button type="submit" variant="outline">Search</Button>
      </LiveSearchForm>
      {jobs.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table>
            <THead><TR><TH>Job</TH><TH>Location</TH><TH>Status</TH><TH /></TR></THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={j.id}>
                  <TD><span className="font-medium">{j.title}</span><p className="text-xs text-muted-foreground">{j.displayId}</p></TD>
                  <TD>{j.city}, {j.state}</TD>
                  <TD><JobStatusBadge status={j.status} /></TD>
                  <TD className="text-right">
                    {applied.has(j.id) ? (
                      <span className="text-xs text-muted-foreground">Already applied</span>
                    ) : (
                      <Link href={`/admin/jobs/${j.displayId}/add-candidate?candidate=${candidate.displayId}`} className={buttonVariants({ size: "sm" })}>Select</Link>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No open or draft jobs found" description="Only draft and open jobs you can access are listed." />
      )}
    </>
  );
}
