import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Folder, FolderOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { param, parsePage, type SearchParams } from "@/lib/pagination";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listCaseFiles } from "@/modules/case-files/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Case files" };

const PAGE_SIZE = 48;

/** Case files shown as folders (one per job). Opening one shows its application folders. */
export default async function CaseFilesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CASE_FILE_VIEW);
  const params = await searchParams;
  const page = parsePage(params.page);
  const q = param(params, "q")?.slice(0, 100);
  const { total, caseFiles } = await listCaseFiles(ctx, q, page, PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Case files"
        description="One case file per job. Open a case file to see its application folders."
        actions={
          <LiveSearchForm className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Search case files" className="w-64" aria-label="Search case files" />
            <Button type="submit" variant="outline" size="icon" aria-label="Search"><Search /></Button>
          </LiveSearchForm>
        }
      />
      {caseFiles.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {caseFiles.map((cf) => {
            const count = cf._count.folders;
            return (
              <Link
                key={cf.id}
                href={`/admin/case-files/${cf.job.displayId}`}
                title={`${cf.displayId} — ${cf.job.title}`}
                className="group flex flex-col rounded-lg border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-md border bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Folder className="size-5 group-hover:hidden" aria-hidden />
                    <FolderOpen className="hidden size-5 group-hover:block" aria-hidden />
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                </div>
                <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground">{cf.displayId}</p>
                <p className="mt-0.5 truncate font-semibold">{cf.job.title}</p>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{count ? `${count} application ${count === 1 ? "folder" : "folders"}` : "Empty"}</span>
                  <span>{cf.job.displayId}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Folder />} title={q ? "No case files match" : "No case files yet"} description="A case file is created automatically for every new job." />
      )}
      <Pagination basePath="/admin/case-files" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
