import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CandidateProfileForm } from "@/components/candidates/candidate-profile-form";
import { ProfileDocuments } from "@/components/documents/profile-documents";
import { param, type SearchParams } from "@/lib/pagination";
import { requireCandidate } from "@/modules/auth/session";
import { EMPTY_STAFF_CANDIDATE, profileToFormValues } from "@/modules/candidates/form-values";
import { getOwnProfile } from "@/modules/candidates/queries";
import { listSkillSuggestions } from "@/modules/jobs/queries";

export const metadata: Metadata = { title: "Profile" };

export default async function CandidateProfilePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireCandidate();
  const [profile, skills] = await Promise.all([getOwnProfile(ctx.profile.id), listSkillSuggestions()]);
  const welcome = !!param(await searchParams, "welcome");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        {welcome && <Alert variant="success">Your email is verified. Complete your profile to start applying.</Alert>}
        <Card>
          <CardHeader>
            <CardTitle>My profile</CardTitle>
            <CardDescription>Candidate ID {profile.displayId} · {profile.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <CandidateProfileForm
              mode="self"
              defaultValues={{ ...EMPTY_STAFF_CANDIDATE, ...profileToFormValues(profile), email: profile.email }}
              skillSuggestions={skills}
            />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Your default resume is used when you apply. Past applications keep the version you submitted.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileDocuments
              documents={profile.documents.map((d) => ({ id: d.id, type: d.type, fileName: d.fileName, sizeBytes: d.sizeBytes, mimeType: d.mimeType }))}
              defaultResumeId={profile.defaultResumeId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
