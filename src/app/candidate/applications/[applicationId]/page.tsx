import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailList } from "@/components/shared/detail-list";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { DocumentList } from "@/components/documents/document-list";
import { EMPLOYMENT_TYPE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import { formatDateTime, formatYears } from "@/lib/format";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { getOwnApplication } from "@/modules/applications/queries";
import { requireCandidate } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Application" };

export default async function CandidateApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { profile } = await requireCandidate();
  const { applicationId } = await params;
  const app = await getOwnApplication(profile.id, applicationId.toUpperCase());
  if (!app) notFound();
  const timeZone = await getViewerTimeZone();
  const submitted = !!param(await searchParams, "submitted");

  return (
    <div className="space-y-6">
      {submitted && (
        <Alert variant="success">
          <p className="font-medium">Application submitted — your Application ID is {app.displayId}.</p>
          <p className="mt-1">Our recruiters will review it and you can track its status here and on your dashboard.</p>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/candidate/applications" className="text-sm text-muted-foreground hover:text-foreground">← My applications</Link>
          <h2 className="mt-1 text-xl font-semibold">{app.job.title}</h2>
          <p className="text-sm text-muted-foreground">
            {app.displayId} · {app.job.displayId} · {formatLocation(app.job.city, app.job.state, app.job.country)}
          </p>
        </div>
        <ApplicationStatusBadge status={app.status} audience="candidate" />
      </div>
      <Card>
        <CardHeader><CardTitle>Application details</CardTitle></CardHeader>
        <CardContent>
          <DetailList
            items={[
              { label: "Applied", value: formatDateTime(app.appliedAt, timeZone) },
              { label: "Status", value: <ApplicationStatusBadge status={app.status} audience="candidate" /> },
              { label: "Work arrangement", value: WORK_ARRANGEMENT_LABELS[app.job.workArrangement] },
              { label: "Employment type", value: EMPLOYMENT_TYPE_LABELS[app.job.employmentType] },
              { label: "Relevant experience", value: app.relevantExperienceYears != null ? formatYears(app.relevantExperienceYears) : null },
              { label: "Availability", value: app.availability },
              { label: "Work authorization", value: app.workAuthorizationResponse },
              { label: "Experience summary", value: app.relevantExperienceSummary, wide: true },
              { label: "Comments", value: app.additionalComments, wide: true },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Submitted documents</CardTitle></CardHeader>
        <CardContent>
          <DocumentList documents={app.documents} />
          <p className="mt-3 text-xs text-muted-foreground">
            These are the exact files submitted with this application. Updating your profile resume does not change them.
          </p>
        </CardContent>
      </Card>
      {(app.job.status === "PUBLISHED" || app.job.status === "CLOSED") && (
        <Link href={`/jobs/${app.job.displayId}`} className="text-sm underline">View job posting</Link>
      )}
    </div>
  );
}
