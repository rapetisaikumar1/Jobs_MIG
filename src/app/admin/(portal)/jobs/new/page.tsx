import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { JobForm } from "@/components/admin/job-form";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { EMPTY_JOB } from "@/modules/jobs/form-values";
import { listSkillSuggestions } from "@/modules/jobs/queries";

export const metadata: Metadata = { title: "Create job" };

export default async function NewJobPage() {
  await requireStaff(PERMISSIONS.JOB_CREATE);
  const skills = await listSkillSuggestions();
  return (
    <div className="max-w-5xl">
      <PageHeader title="Create job" description="Jobs are saved as drafts. Publish when ready to show on the job portal." back={{ href: "/admin/jobs", label: "Jobs" }} />
      <Card><CardContent className="pt-6">
        <JobForm defaultValues={EMPTY_JOB} skillSuggestions={skills} />
      </CardContent></Card>
    </div>
  );
}
