import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { JobForm } from "@/components/admin/job-form";
import { JOB_STATUS_LABELS } from "@/config/options";
import { formatDateTime, fullName } from "@/lib/format";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { jobToFormValues } from "@/modules/jobs/form-values";
import { getAdminJob, listJobFormOptions, listSkillSuggestions } from "@/modules/jobs/queries";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const ctx = await requireStaff(PERMISSIONS.JOB_EDIT);
  const job = await getAdminJob(ctx, (await params).jobId);
  if (!job) notFound();
  const [{ staff }, skills, tz] = await Promise.all([listJobFormOptions(), listSkillSuggestions(), getViewerTimeZone()]);
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Edit ${job.title}`} description="Editing never changes the original posted date." back={{ href: `/admin/jobs/${job.displayId}`, label: job.displayId }} />
      <Card><CardContent className="pt-6">
        <JobForm
          jobId={job.id}
          defaultValues={jobToFormValues(job)}
          staff={staff.map((s) => ({ id: s.id, name: fullName(s) }))}
          skillSuggestions={skills}
          meta={{
            displayId: job.displayId,
            status: JOB_STATUS_LABELS[job.status],
            createdBy: fullName(job.createdBy),
            createdAt: formatDateTime(job.createdAt, tz),
            publishedAt: job.publishedAt ? formatDateTime(job.publishedAt, tz) : "Not yet published",
          }}
        />
      </CardContent></Card>
    </div>
  );
}
