import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { MyApplicationsTable } from "@/components/applications/my-applications-table";
import { getViewerTimeZone } from "@/lib/request";
import { listOwnApplications } from "@/modules/applications/queries";
import { requireCandidate } from "@/modules/auth/session";

export const metadata: Metadata = { title: "My applications" };

export default async function MyApplicationsPage() {
  const { profile } = await requireCandidate();
  const [applications, timeZone] = await Promise.all([listOwnApplications(profile.id), getViewerTimeZone()]);
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {applications.length} {applications.length === 1 ? "application" : "applications"}
      </p>
      {applications.length ? (
        <MyApplicationsTable rows={applications} timeZone={timeZone} />
      ) : (
        <EmptyState
          icon={<ClipboardList />}
          title="No applications yet"
          action={<Link href="/jobs" className={buttonVariants()}>Find jobs</Link>}
        />
      )}
    </div>
  );
}
