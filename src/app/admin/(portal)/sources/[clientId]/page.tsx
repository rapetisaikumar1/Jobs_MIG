import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { FlashNotice } from "@/components/shared/flash-notice";
import { PageHeader } from "@/components/shared/page-header";
import { JobStatusBadge } from "@/components/shared/status-badges";
import { ActionButton } from "@/components/forms/action-button";
import { ClientForm } from "@/components/admin/client-form";
import { formatDate, formatPhone, fullName } from "@/lib/format";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { uuid } from "@/lib/validation";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { deleteClientAction, setClientActiveAction } from "@/modules/clients/actions";
import { getClient, listClientJobs } from "@/modules/clients/queries";

export const metadata: Metadata = { title: "Source" };

const JOBS_SHOWN = 100;

export default async function ClientPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CLIENT_VIEW);
  const id = uuid.safeParse((await params).clientId);
  if (!id.success) notFound();
  const [client, jobs, tz] = await Promise.all([getClient(id.data), listClientJobs(ctx, id.data, JOBS_SHOWN), getViewerTimeZone()]);
  if (!client) notFound();
  const canManage = ctx.can(PERMISSIONS.CLIENT_MANAGE);
  const jobCount = client._count.jobs;
  const hasJobs = jobCount > 0;
  const notice = param(await searchParams, "notice");

  async function remove() {
    "use server";
    const result = await deleteClientAction({ clientId: id.data! });
    // The client no longer exists, so confirm on the list.
    if (result.ok) redirect("/admin/sources?notice=deleted");
    return result;
  }

  const added = `Added ${formatDate(client.createdAt, tz)}${client.createdBy ? ` by ${fullName(client.createdBy)}` : ""}`;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3 [overflow-wrap:anywhere]">{client.name} {client.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge tone="muted" dot>Inactive</Badge>}</span>}
        description={`${added} · Updated ${formatDate(client.updatedAt, tz)}`}
        back={{ href: "/admin/sources", label: "Sources" }}
        actions={canManage && (
          <>
            <ActionButton
              variant="outline"
              confirm={client.isActive
                ? `Deactivate ${client.name}? It can no longer be chosen for new jobs. Existing jobs keep this source.`
                : `Reactivate ${client.name}? It can be chosen for new jobs again.`}
              action={setClientActiveAction.bind(null, { clientId: client.id, active: !client.isActive })}
            >
              {client.isActive ? "Deactivate" : "Reactivate"}
            </ActionButton>
            <ActionButton
              variant="destructive"
              disabled={hasJobs}
              title={hasJobs ? "Sources with jobs can't be deleted. Deactivate the source instead." : undefined}
              confirm={`Delete ${client.name}? This cannot be undone.`}
              action={remove}
            >
              <Trash2 aria-hidden /> Delete
            </ActionButton>
          </>
        )}
      />
      {notice === "created" && <FlashNotice><Alert variant="success">Source {client.name} created. You can now choose it when creating a job.</Alert></FlashNotice>}
      {!client.isActive && (
        <Alert variant="neutral">This source is inactive. It can&apos;t be chosen for new jobs; jobs already linked to it keep it.</Alert>
      )}
      {canManage && hasJobs && (
        <Alert variant="neutral">
          This source has {jobCount} job{jobCount === 1 ? "" : "s"}, so it can&apos;t be deleted. Deactivate it instead to stop it being chosen for new jobs.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Internal only · never shown to candidates.</CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <ClientForm
              clientId={client.id}
              defaultValues={{
                name: client.name,
                contactName: client.contactName ?? "",
                contactEmail: client.contactEmail ?? "",
                contactPhone: client.contactPhone ?? "",
                website: client.website ?? "",
                notes: client.notes ?? "",
              }}
            />
          ) : (
            <DetailList
              items={[
                { label: "Contact name", value: client.contactName },
                { label: "Contact email", value: client.contactEmail && <a href={`mailto:${client.contactEmail}`} className="hover:underline">{client.contactEmail}</a> },
                { label: "Contact phone", value: client.contactPhone && <a href={`tel:${client.contactPhone}`} className="hover:underline">{formatPhone(client.contactPhone)}</a> },
                { label: "Website", value: client.website && <a href={client.website} target="_blank" rel="noopener noreferrer" className="hover:underline [overflow-wrap:anywhere]">{client.website}</a> },
                { label: "Notes", value: client.notes && <span className="whitespace-pre-line">{client.notes}</span>, wide: true },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>
            {jobs.length === 0
              ? "Jobs for this source appear here."
              : jobs.length >= JOBS_SHOWN
                ? `The ${JOBS_SHOWN} most recent jobs you can access.`
                : `${jobs.length} job${jobs.length === 1 ? "" : "s"}${ctx.can(PERMISSIONS.JOB_VIEW_ALL) ? "" : " you can access"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length ? (
            <div className="overflow-hidden rounded-lg border">
              <Table className="[&_td]:px-3 [&_th]:px-3">
                <THead>
                  <TR>
                    <TH className="hidden sm:table-cell">Job ID</TH>
                    <TH>Title</TH>
                    <TH>Status</TH>
                    <TH className="hidden md:table-cell">Posted</TH>
                  </TR>
                </THead>
                <TBody>
                  {jobs.map((j) => (
                    <TR key={j.id}>
                      <TD className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{j.displayId}</TD>
                      <TD className="min-w-40">
                        <Link href={`/admin/jobs/${j.displayId}`} className="block font-medium [overflow-wrap:anywhere] hover:underline">{j.title}</Link>
                        <span className="block text-xs text-muted-foreground sm:hidden">{j.displayId}</span>
                      </TD>
                      <TD className="whitespace-nowrap"><JobStatusBadge status={j.status} /></TD>
                      <TD className="hidden whitespace-nowrap md:table-cell">{j.publishedAt ? formatDate(j.publishedAt, tz) : "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={<Briefcase />}
              title="No jobs"
              description={hasJobs ? "This source's jobs are not in your job list." : "Choose this source when creating or editing a job."}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
