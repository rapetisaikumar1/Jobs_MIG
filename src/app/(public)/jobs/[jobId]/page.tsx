import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailList, TagList } from "@/components/shared/detail-list";
import { JobPill, JobTile, publicCompensation } from "@/components/jobs/job-card";
import { EMPLOYMENT_TYPE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import { formatCalendarDate, formatExperienceRange, formatLongDate, isDeadlinePassed } from "@/lib/format";
import { getViewerTimeZone } from "@/lib/request";
import { getPublicJob } from "@/modules/jobs/queries";
import { getAppliedJobIds } from "@/modules/jobs/viewer";
import { getAuthUser } from "@/modules/auth/session";

type Props = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await getPublicJob((await params).jobId);
  return job
    ? { title: `${job.title} — ${formatLocation(job.city, job.state, job.country)}`, description: job.description.slice(0, 160) }
    : { title: "Job not found" };
}

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params;
  const job = await getPublicJob(jobId);
  if (!job) notFound();

  const [timeZone, applied, authUser] = await Promise.all([getViewerTimeZone(), getAppliedJobIds(), getAuthUser()]);
  const alreadyApplied = applied.has(job.id);
  const acceptingApplications = job.status === "PUBLISHED" && !isDeadlinePassed(job.applicationDeadline);
  const pay = publicCompensation(job);
  const required = job.skills.filter((s) => s.type === "REQUIRED").map((s) => s.skill.name);
  const preferred = job.skills.filter((s) => s.type === "PREFERRED").map((s) => s.skill.name);
  const applyHref = `/jobs/${job.displayId}/apply`;

  const applyBlock = alreadyApplied ? (
    <span className={buttonVariants({ variant: "secondary", className: "w-full pointer-events-none" })} aria-disabled>
      <CheckCircle2 aria-hidden /> Already Applied
    </span>
  ) : !acceptingApplications ? (
    <span className={buttonVariants({ variant: "secondary", className: "w-full pointer-events-none" })} aria-disabled>
      No longer accepting applications
    </span>
  ) : authUser ? (
    <Link href={applyHref} className={buttonVariants({ size: "lg", className: "w-full" })}>Apply Now</Link>
  ) : (
    <Link href={`/login?next=${encodeURIComponent(applyHref)}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
      Sign in to Apply
    </Link>
  );

  const responsibilityItems = (job.responsibilities ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
  const section = "rounded-xl border bg-card p-6 shadow-xs";

  return (
    <div className="bg-surface">
      <div className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">← Back to all jobs</Link>
          <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 gap-5">
              <JobTile size="lg" />
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{job.title}</h1>
                <p className="mt-1.5 text-muted-foreground">
                  {formatLocation(job.city, job.state, job.country)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {acceptingApplications ? <Badge tone="success" dot>Open</Badge> : <Badge tone="neutral" dot>Closed</Badge>}
                  {acceptingApplications && job.isFeatured && <Badge tone="dark">Featured</Badge>}
                  {alreadyApplied && <Badge tone="info" dot>Already applied</Badge>}
                  <JobPill>{WORK_ARRANGEMENT_LABELS[job.workArrangement]}</JobPill>
                  <JobPill>{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</JobPill>
                  <JobPill>{formatExperienceRange(job.minExperience, job.maxExperience)}</JobPill>
                  {pay && <JobPill className="bg-emerald-50 text-emerald-800">{pay}</JobPill>}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {job.displayId} · Posted {formatLongDate(job.publishedAt, timeZone)}
                  {job.applicationDeadline && <> · Apply by {formatCalendarDate(job.applicationDeadline)}</>}
                </p>
              </div>
            </div>
            <div className="w-full shrink-0 md:w-56">{applyBlock}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 pt-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {!acceptingApplications && !alreadyApplied && (
            <Alert variant="neutral">This position is no longer accepting applications.</Alert>
          )}
          <section className={section}>
            <h2 className="text-lg font-semibold">About the role</h2>
            <div className="prose-text mt-3 text-[15px] text-foreground/90">{job.description}</div>
          </section>
          {responsibilityItems.length > 0 && (
            <section className={section}>
              <h2 className="text-lg font-semibold">Responsibilities</h2>
              <ul className="mt-3 space-y-2 text-[15px] text-foreground/90">
                {responsibilityItems.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-foreground/40" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className={section}>
            <h2 className="text-lg font-semibold">Skills</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required</h3>
                <TagList items={required} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nice to have</h3>
                <TagList items={preferred} empty="None specified" />
              </div>
            </div>
          </section>
          {job.education && (
            <section className={section}>
              <h2 className="text-lg font-semibold">Education</h2>
              <p className="prose-text mt-3 text-[15px] text-foreground/90">{job.education}</p>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader><CardTitle>Job overview</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <DetailList
                columns={1}
                items={[
                  { label: "Job ID", value: job.displayId },
                  { label: "Location", value: formatLocation(job.city, job.state, job.country) },
                  { label: "Work arrangement", value: WORK_ARRANGEMENT_LABELS[job.workArrangement] },
                  { label: "Employment type", value: EMPLOYMENT_TYPE_LABELS[job.employmentType] },
                  { label: "Experience", value: formatExperienceRange(job.minExperience, job.maxExperience) },
                  ...(pay ? [{ label: job.compensationType === "HOURLY" ? "Rate" : "Salary", value: pay }] : []),
                  { label: "Posted", value: formatLongDate(job.publishedAt, timeZone) },
                  { label: "Application deadline", value: job.applicationDeadline ? formatCalendarDate(job.applicationDeadline) : "Open until filled" },
                ]}
              />
              {applyBlock}
              {alreadyApplied && (
                <Link href="/candidate/applications" className="block text-center text-sm underline">View my applications</Link>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
