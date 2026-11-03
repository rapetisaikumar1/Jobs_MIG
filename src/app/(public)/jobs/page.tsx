import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { JobCard } from "@/components/jobs/job-card";
import { JobFilterSidebar } from "@/components/jobs/job-filters";
import { LiveJobSearch } from "@/components/jobs/live-job-search";
import { MobileFilterToggle } from "@/components/jobs/mobile-filter-toggle";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { listPublicJobs } from "@/modules/jobs/queries";
import { parsePublicJobFilters } from "@/modules/jobs/public-filters";
import { getAppliedJobIds } from "@/modules/jobs/viewer";

export const metadata: Metadata = { title: "IT Jobs", description: "Open IT positions across the United States and Canada." };

const PAGE_SIZE = 20;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = parsePublicJobFilters(params);
  const page = parsePage(params.page);
  const [{ total, jobs }, timeZone, applied] = await Promise.all([
    listPublicJobs(filters, page, PAGE_SIZE),
    getViewerTimeZone(),
    getAppliedJobIds(),
  ]);
  const skills = (filters.skills ?? []).join(", ");

  return (
    <form action="/jobs" method="get">
      <section className="border-b bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find IT jobs in the US and Canada</h1>
          <p className="mt-1 text-muted-foreground">Software, data, cloud and infrastructure roles — full-time and contract.</p>
          <div className="mt-5"><LiveJobSearch q={filters.q} location={filters.location} /></div>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-20 pt-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <MobileFilterToggle>
            <JobFilterSidebar filters={filters} skills={skills} />
          </MobileFilterToggle>
        </aside>
        <section className="min-w-0">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="text-base font-semibold text-foreground">{total.toLocaleString("en-US")}</span> {total === 1 ? "job" : "jobs"}
              {filters.q && <> for “{filters.q}”</>}
              {filters.location && <> in {filters.location}</>}
            </p>
            <p className="text-xs text-muted-foreground">Sorted by newest</p>
          </div>
          {jobs.length ? (
            <div className="space-y-2.5">
              {jobs.map((job) => <JobCard key={job.id} job={job} timeZone={timeZone} applied={applied.has(job.id)} />)}
            </div>
          ) : (
            <EmptyState icon={<Briefcase />} title="No jobs match your search" description="Try removing a filter or searching for a broader title or skill." className="bg-card" />
          )}
          <Pagination basePath="/jobs" params={params} page={page} pageSize={PAGE_SIZE} total={total} />
        </section>
      </div>
    </form>
  );
}
