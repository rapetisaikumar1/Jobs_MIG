import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Folder, FolderOpen, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { SOURCE_LABELS } from "@/config/options";
import { formatDate, fullName } from "@/lib/format";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { getCaseFile } from "@/modules/case-files/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Case files" };

/** A job's folder: one sub-folder per application. Opening a folder shows its contents. */
export default async function JobFoldersPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CASE_FILE_VIEW);
  const q = param(await searchParams, "q")?.slice(0, 100);
  const data = await getCaseFile(ctx, (await params).jobId, q);
  if (!data) notFound();
  const { job, folders } = data;
  const tz = await getViewerTimeZone();
  const canAdd = ctx.can(PERMISSIONS.CANDIDATE_ADD) && (job.status === "DRAFT" || job.status === "PUBLISHED");

  return (
    <>
      <Breadcrumbs items={[{ label: "Case files", href: "/admin/case-files" }, { label: job.title }]} />
      <PageHeader
        title={job.title}
        description={
          <>
            <Link href={`/admin/jobs/${job.displayId}`} className="hover:underline">{job.displayId}</Link> ·{" "}
            {data.caseFile._count.folders} application {data.caseFile._count.folders === 1 ? "folder" : "folders"}
          </>
        }
        actions={
          <>
            <LiveSearchForm className="flex gap-2">
              <Input name="q" defaultValue={q} placeholder="Search name, email, ID, skill" className="w-60" aria-label="Search folders" />
              <Button type="submit" variant="outline" size="icon" aria-label="Search"><Search /></Button>
            </LiveSearchForm>
            {canAdd && <Link href={`/admin/jobs/${job.displayId}/add-candidate`} className={buttonVariants()}>Add candidate</Link>}
          </>
        }
      />
      {q && (
        <p className="-mt-3 mb-4 text-sm text-muted-foreground">
          {folders.length} {folders.length === 1 ? "folder matches" : "folders match"} “{q}” · <Link href="?" className="underline">Clear</Link>
        </p>
      )}

      {folders.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {folders.map((folder) => {
            const app = folder.application;
            const docs = folder._count.documents;
            return (
              <Link
                key={folder.id}
                href={`/admin/case-files/${job.displayId}/${app.displayId}`}
                className="group flex flex-col rounded-lg border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-10 items-center justify-center rounded-md border bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Folder className="size-5 group-hover:hidden" aria-hidden />
                    <FolderOpen className="hidden size-5 group-hover:block" aria-hidden />
                  </span>
                  <ApplicationStatusBadge status={app.status} />
                </div>
                <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground">{app.displayId}</p>
                <p className="mt-0.5 flex items-center justify-between gap-2 font-semibold">
                  <span className="truncate">{fullName(app.candidate)}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                </p>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{SOURCE_LABELS[app.source]} · {formatDate(app.appliedAt, tz)}</span>
                  <span>{docs + 1} {docs + 1 === 1 ? "item" : "items"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Folder />}
          title={q ? "No folders match your search" : "No applications yet"}
          description="Each application to this job gets its own folder here automatically."
        />
      )}
    </>
  );
}
