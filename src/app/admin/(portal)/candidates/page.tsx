import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { CandidateTable } from "@/components/candidates/candidate-table";
import { DEFAULT_PAGE_SIZE, param, parsePage, type SearchParams } from "@/lib/pagination";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listInternalCandidates } from "@/modules/candidates/queries";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CANDIDATE_VIEW);
  const params = await searchParams;
  const page = parsePage(params.page);
  const q = param(params, "q")?.slice(0, 100);
  const { total, candidates } = await listInternalCandidates(q, page);

  return (
    <>
      <PageHeader
        title="Candidates"
        description={
          <>
            Internal candidates added by your team. Job portal applicants are under{" "}
            <Link href="/admin/applications" className="underline">Applications</Link>.
          </>
        }
        actions={
          <>
            <Link href="/admin/search" className={buttonVariants({ variant: "outline" })}>Advanced search</Link>
            {ctx.can(PERMISSIONS.CANDIDATE_ADD) && <Link href="/admin/candidates/new" className={buttonVariants()}>Add candidate</Link>}
          </>
        }
      />
      <LiveSearchForm className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input name="q" defaultValue={q} placeholder="Name, email, phone or Candidate ID" aria-label="Search candidates" className="max-w-md flex-1" />
        <Button type="submit" variant="outline">Search</Button>
      </LiveSearchForm>
      {candidates.length ? (
        <CandidateTable rows={candidates} />
      ) : (
        <EmptyState
          icon={<Users />}
          title={q ? "No internal candidates match your search" : "No internal candidates yet"}
          description="Add candidates you source yourself; job portal sign-ups are not listed here."
          action={ctx.can(PERMISSIONS.CANDIDATE_ADD) ? <Link href="/admin/candidates/new" className={buttonVariants()}>Add candidate</Link> : undefined}
        />
      )}
      <Pagination basePath="/admin/candidates" params={params} page={page} pageSize={DEFAULT_PAGE_SIZE} total={total} />
    </>
  );
}
