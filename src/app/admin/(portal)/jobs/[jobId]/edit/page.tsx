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
import { getAdminJob, listSkillSuggestions } from "@/modules/jobs/queries";
import { listClientOptions } from "@/modules/clients/queries";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const ctx = await requireStaff(PERMISSIONS.JOB_EDIT);
  const job = await getAdminJob(ctx, (await params).jobId);
  if (!job) notFound();
  // Clients are internal: the Client field is only offered to staff who may view clients (the
  // server ignores the field for everyone else, so the job keeps its client).
  const canViewClients = ctx.can(PERMISSIONS.CLIENT_VIEW);
  const [skills, tz, clients] = await Promise.all([
    listSkillSuggestions(),
    getViewerTimeZone(),
    canViewClients ? listClientOptions() : undefined,
  ]);
  const values = jobToFormValues(job);
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Edit ${job.title}`} description="Editing never changes the original posted date." back={{ href: `/admin/jobs/${job.displayId}`, label: job.displayId }} />
      <Card><CardContent className="pt-6">
        <JobForm
          jobId={job.id}
          defaultValues={canViewClients ? values : { ...values, clientId: "" }}
          skillSuggestions={skills}
          clients={clients}
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
