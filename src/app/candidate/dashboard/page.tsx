import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Star, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { MyApplicationsTable } from "@/components/applications/my-applications-table";
import { getViewerTimeZone } from "@/lib/request";
import { listOwnApplications } from "@/modules/applications/queries";
import { summarizeCandidateApplications } from "@/modules/applications/status";
import { requireCandidate } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CandidateDashboardPage() {
  const { profile } = await requireCandidate();
  const [applications, timeZone] = await Promise.all([listOwnApplications(profile.id), getViewerTimeZone()]);
  const summary = summarizeCandidateApplications(applications.map((a) => a.status));
  const profileIncomplete = !profile.defaultResumeId || !profile.totalExperienceYears || !profile.phone;

  return (
    <div className="space-y-8">
      {profileIncomplete && (
        <Alert variant="info">
          Complete your profile and upload a default resume so you can apply in one step.{" "}
          <Link href="/candidate/profile" className="font-medium underline">Update profile</Link>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total applications" value={summary.total} icon={<ClipboardList />} />
        <StatCard label="Active applications" value={summary.active} icon={<CheckCircle2 />} />
        <StatCard label="Shortlisted" value={summary.shortlisted} icon={<Star />} />
        <StatCard label="Not selected" value={summary.rejected} icon={<XCircle />} />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My applications</h2>
          <Link href="/jobs" className={buttonVariants({ variant: "outline", size: "sm" })}>Browse jobs</Link>
        </div>
        {applications.length ? (
          <MyApplicationsTable rows={applications.slice(0, 10)} timeZone={timeZone} />
        ) : (
          <EmptyState
            icon={<ClipboardList />}
            title="You haven't applied to any jobs yet"
            description="Find a role that matches your skills and apply in a few clicks."
            action={<Link href="/jobs" className={buttonVariants()}>Find jobs</Link>}
          />
        )}
      </section>
    </div>
  );
}
