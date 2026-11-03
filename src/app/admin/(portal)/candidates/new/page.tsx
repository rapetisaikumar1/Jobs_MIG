import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { CandidateProfileForm } from "@/components/candidates/candidate-profile-form";
import { fullName } from "@/lib/format";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listActiveStaff } from "@/modules/applications/queries";
import { EMPTY_STAFF_CANDIDATE } from "@/modules/candidates/form-values";
import { listSkillSuggestions } from "@/modules/jobs/queries";

export const metadata: Metadata = { title: "Add candidate" };

export default async function NewCandidatePage() {
  await requireStaff(PERMISSIONS.CANDIDATE_ADD);
  const [staff, skills] = await Promise.all([listActiveStaff(), listSkillSuggestions()]);
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Add candidate"
        description="Internal candidate record. No job portal login is created. Email is used to prevent duplicates."
        back={{ href: "/admin/candidates", label: "Candidates" }}
      />
      <Card><CardContent className="pt-6">
        <CandidateProfileForm
          mode="staff-create"
          defaultValues={EMPTY_STAFF_CANDIDATE}
          staffOptions={staff.map((s) => ({ id: s.id, name: fullName(s) }))}
          skillSuggestions={skills}
        />
      </CardContent></Card>
    </div>
  );
}
