import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailList, TagList } from "@/components/shared/detail-list";
import { ApplyForm } from "@/components/applications/apply-form";
import { COUNTRY_LABELS, WORK_AUTH_STATUS_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import { formatPhone, formatYears, fullName, isDeadlinePassed } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/modules/auth/session";
import { getPublicJob } from "@/modules/jobs/queries";

export const metadata: Metadata = { title: "Apply" };

export default async function ApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { profile } = await requireCandidate(`/jobs/${jobId}/apply`);
  const job = await getPublicJob(jobId);
  if (!job) notFound();
  if (job.status !== "PUBLISHED" || isDeadlinePassed(job.applicationDeadline)) redirect(`/jobs/${job.displayId}`);

  const existing = await prisma.application.findUnique({ where: { candidateId_jobId: { candidateId: profile.id, jobId: job.id } } });
  if (existing) redirect(`/jobs/${job.displayId}`);

  const full = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: { skills: { include: { skill: true } }, defaultResume: true },
  });
  const defaultResume = full.defaultResume?.status === "ACTIVE" ? { id: full.defaultResume.id, fileName: full.defaultResume.fileName } : null;
  const workAuth = full.workAuthStatus
    ? `${full.workAuthCountry ? COUNTRY_LABELS[full.workAuthCountry] + " — " : ""}${WORK_AUTH_STATUS_LABELS[full.workAuthStatus]}`
    : undefined;
  const missing = [!full.phone && "phone number", !full.totalExperienceYears && "years of experience", !full.skills.length && "skills"].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href={`/jobs/${job.displayId}`} className="text-sm text-muted-foreground hover:text-foreground">← Back to job</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Apply: {job.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {job.displayId} · {formatLocation(job.city, job.state, job.country)}
      </p>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Your details (from your profile)</CardTitle>
          <Link href="/candidate/profile" className="text-sm underline">Edit profile</Link>
        </CardHeader>
        <CardContent>
          {missing.length > 0 && (
            <Alert variant="info" className="mb-4">
              Your profile is missing: {missing.join(", ")}. A complete profile helps recruiters match you to this role.
            </Alert>
          )}
          <DetailList
            columns={3}
            items={[
              { label: "Name", value: fullName(full) },
              { label: "Email", value: full.email },
              { label: "Phone", value: formatPhone(full.phone) },
              { label: "Location", value: formatLocation(full.city, full.state, full.country) },
              { label: "Current title", value: full.currentTitle ?? full.professionalTitle },
              { label: "Total experience", value: formatYears(full.totalExperienceYears) },
              { label: "Primary skills", value: <TagList items={full.skills.filter((s) => s.level === "PRIMARY").map((s) => s.skill.name)} />, wide: true },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Application</CardTitle></CardHeader>
        <CardContent>
          <ApplyForm
            jobId={job.id}
            jobTitle={job.title}
            defaultResume={defaultResume}
            defaults={{
              relevantExperienceYears: full.relevantExperienceYears ?? undefined,
              availability: full.noticePeriodDays != null ? (full.noticePeriodDays === 0 ? "Immediately" : `${full.noticePeriodDays} days' notice`) : undefined,
              workAuthorizationResponse: workAuth,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
