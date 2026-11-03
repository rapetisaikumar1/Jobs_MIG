import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { CandidateProfileForm } from "@/components/candidates/candidate-profile-form";
import { fullName } from "@/lib/format";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listActiveStaff } from "@/modules/applications/queries";
import { staffProfileToFormValues } from "@/modules/candidates/form-values";
import { getCandidateForStaff } from "@/modules/candidates/queries";
import { listSkillSuggestions } from "@/modules/jobs/queries";

export const metadata: Metadata = { title: "Edit candidate" };

export default async function EditCandidatePage({ params }: { params: Promise<{ candidateId: string }> }) {
  const ctx = await requireStaff(PERMISSIONS.CANDIDATE_EDIT);
  const candidate = await getCandidateForStaff(ctx, (await params).candidateId);
  if (!candidate) notFound();
  const [staff, skills] = await Promise.all([listActiveStaff(), listSkillSuggestions()]);
  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`Edit ${fullName(candidate)}`}
        description={`${candidate.displayId} · Changes do not alter profiles already submitted with applications.`}
        back={{ href: `/admin/candidates/${candidate.displayId}`, label: candidate.displayId }}
      />
      <Card><CardContent className="pt-6">
        <CandidateProfileForm
          mode="staff-edit"
          candidateId={candidate.id}
          candidateDisplayId={candidate.displayId}
          emailLocked={!!candidate.userId}
          defaultValues={staffProfileToFormValues(candidate)}
          staffOptions={staff.map((s) => ({ id: s.id, name: fullName(s) }))}
          skillSuggestions={skills}
        />
      </CardContent></Card>
    </div>
  );
}
