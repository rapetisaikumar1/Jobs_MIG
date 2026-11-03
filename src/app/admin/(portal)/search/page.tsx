import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { CandidateResultCard } from "@/components/candidates/candidate-result-card";
import {
  APPLICATION_STATUS_LABELS,
  COMPENSATION_TYPE_LABELS,
  COUNTRY_LABELS,
  CURRENCY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  QUALIFICATION_LABELS,
  SOURCE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  WORK_AUTH_STATUS_LABELS,
  toOptions,
} from "@/config/options";
import { CA_PROVINCES, US_STATES } from "@/config/locations";
import { toDateInputValue } from "@/lib/format";
import { parsePage, type SearchParams } from "@/lib/pagination";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { hasAnyFilter, parseCandidateSearch, SEARCH_SORTS } from "@/modules/search/candidate-search";
import { searchCandidates } from "@/modules/search/service";
import { FilterSection } from "@/components/forms/filter-section";
import { LiveSearchForm } from "@/components/forms/live-search-form";

export const metadata: Metadata = { title: "Advanced search" };

const PAGE_SIZE = 25;

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Opt({ labels, any = "Any" }: { labels: Record<string, string>; any?: string }) {
  return (
    <>
      <option value="">{any}</option>
      {toOptions(labels).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </>
  );
}

export default async function AdvancedSearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CANDIDATE_VIEW);
  const params = await searchParams;
  const f = parseCandidateSearch(params);
  const page = parsePage(params.page);
  const active = hasAnyFilter(f);
  const result = active ? await searchCandidates(ctx, f, page, PAGE_SIZE) : null;
  const v = (n: number | undefined) => (n === undefined ? "" : String(n));

  const activeCount = Object.entries(f).filter(([k, val]) => k !== "sort" && (Array.isArray(val) ? val.length > 0 : val !== undefined)).length;
  const section = "border-t px-4 py-4";
  const summary = "flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden";
  const two = "grid grid-cols-2 gap-2";

  return (
    <>
      <PageHeader title="Advanced candidate search" description="Search job portal and internal candidates. Filters combine; every listed skill must match." />
      <LiveSearchForm className="grid items-start gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="overflow-hidden rounded-xl border bg-card shadow-xs xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">Filters{activeCount > 0 && <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{activeCount}</span>}</p>
            <Link href="/admin/search" className="text-xs font-medium text-muted-foreground hover:text-foreground">Clear all</Link>
          </div>
          <div className="space-y-3 border-t px-4 py-4">
            <F label="Keywords (full-text)"><Input name="q" defaultValue={f.q} placeholder='e.g. "data engineer" azure' /></F>
            <F label="Primary skills (all required)"><Input name="primarySkills" defaultValue={f.primarySkills.join(", ")} placeholder="Java" /></F>
            <F label="Other skills (all required)"><Input name="skills" defaultValue={f.skills.join(", ")} placeholder="Spring Boot, AWS" /></F>
            <F label="Current / professional title"><Input name="currentTitle" defaultValue={f.currentTitle} /></F>
            <F label="Total experience (years)">
              <div className={two}><Input name="minExp" type="number" min={0} defaultValue={v(f.minExp)} placeholder="Min" /><Input name="maxExp" type="number" min={0} defaultValue={v(f.maxExp)} placeholder="Max" /></div>
            </F>
            <div className={two}>
              <F label="Relevant exp. (min)"><Input name="minRelevantExp" type="number" min={0} defaultValue={v(f.minRelevantExp)} /></F>
              <F label="Source"><Select name="source" defaultValue={f.source ?? ""}><Opt labels={SOURCE_LABELS} /></Select></F>
            </div>
          </div>

          <FilterSection className={section} initialOpen={!!(f.country || f.state || f.city || f.preferredLocation || f.workArrangement || f.employmentType)}>
            <summary className={summary}>Location &amp; preferences <span className="text-muted-foreground">+</span></summary>
            <div className="mt-3 space-y-3">
              <div className={two}>
                <F label="Country"><Select name="country" defaultValue={f.country ?? ""}><Opt labels={COUNTRY_LABELS} /></Select></F>
                <F label="State / Province">
                  <Select name="state" defaultValue={f.state ?? ""}>
                    <option value="">Any</option>
                    <optgroup label="Canada">{CA_PROVINCES.map((r) => <option key={`CA-${r.code}`} value={r.code}>{r.name}</option>)}</optgroup>
                    <optgroup label="United States">{US_STATES.map((r) => <option key={`US-${r.code}`} value={r.code}>{r.name}</option>)}</optgroup>
                  </Select>
                </F>
              </div>
              <div className={two}>
                <F label="City"><Input name="city" defaultValue={f.city} /></F>
                <F label="Preferred location"><Input name="preferredLocation" defaultValue={f.preferredLocation} /></F>
              </div>
              <div className={two}>
                <F label="Work arrangement"><Select name="workArrangement" defaultValue={f.workArrangement ?? ""}><Opt labels={WORK_ARRANGEMENT_LABELS} /></Select></F>
                <F label="Employment type"><Select name="employmentType" defaultValue={f.employmentType ?? ""}><Opt labels={EMPLOYMENT_TYPE_LABELS} /></Select></F>
              </div>
            </div>
          </FilterSection>

          <FilterSection className={section} initialOpen={!!(f.minSalary !== undefined || f.maxSalary !== undefined || f.currency || f.compensationType || f.availableWithinDays !== undefined || f.workAuthCountry || f.workAuthStatus)}>
            <summary className={summary}>Pay, availability &amp; authorization <span className="text-muted-foreground">+</span></summary>
            <div className="mt-3 space-y-3">
              <F label="Expected salary / rate">
                <div className={two}><Input name="minSalary" type="number" min={0} defaultValue={v(f.minSalary)} placeholder="Min" /><Input name="maxSalary" type="number" min={0} defaultValue={v(f.maxSalary)} placeholder="Max" /></div>
              </F>
              <div className={two}>
                <F label="Currency"><Select name="currency" defaultValue={f.currency ?? ""}><Opt labels={CURRENCY_LABELS} /></Select></F>
                <F label="Pay type"><Select name="compensationType" defaultValue={f.compensationType ?? ""}><Opt labels={COMPENSATION_TYPE_LABELS} /></Select></F>
              </div>
              <F label="Available within (days)"><Input name="availableWithinDays" type="number" min={0} defaultValue={v(f.availableWithinDays)} placeholder="30" /></F>
              <div className={two}>
                <F label="Authorization country"><Select name="workAuthCountry" defaultValue={f.workAuthCountry ?? ""}><Opt labels={{ US: "United States", CA: "Canada" }} /></Select></F>
                <F label="Authorization status"><Select name="workAuthStatus" defaultValue={f.workAuthStatus ?? ""}><Opt labels={WORK_AUTH_STATUS_LABELS} /></Select></F>
              </div>
            </div>
          </FilterSection>

          <FilterSection className={section} initialOpen={!!(f.qualification || f.education || f.certification)}>
            <summary className={summary}>Education &amp; certifications <span className="text-muted-foreground">+</span></summary>
            <div className="mt-3 space-y-3">
              <F label="Education level"><Select name="qualification" defaultValue={f.qualification ?? ""}><Opt labels={QUALIFICATION_LABELS} /></Select></F>
              <F label="Education text"><Input name="education" defaultValue={f.education} placeholder="Computer Science" /></F>
              <F label="Certification"><Input name="certification" defaultValue={f.certification} placeholder="AWS" /></F>
            </div>
          </FilterSection>

          <FilterSection className={section} initialOpen={!!(f.name || f.email || f.phone || f.candidateId)}>
            <summary className={summary}>Identity <span className="text-muted-foreground">+</span></summary>
            <div className="mt-3 space-y-3">
              <F label="Candidate name"><Input name="name" defaultValue={f.name} /></F>
              <div className={two}>
                <F label="Email"><Input name="email" defaultValue={f.email} /></F>
                <F label="Phone"><Input name="phone" defaultValue={f.phone} /></F>
              </div>
              <F label="Candidate ID"><Input name="candidateId" defaultValue={f.candidateId} placeholder="MIG-CAN-000001" /></F>
            </div>
          </FilterSection>

          <FilterSection className={section} initialOpen={!!(f.applicationStatus || f.jobId || f.appliedFrom || f.appliedTo)}>
            <summary className={summary}>Applications <span className="text-muted-foreground">+</span></summary>
            <div className="mt-3 space-y-3">
              <div className={two}>
                <F label="Status"><Select name="applicationStatus" defaultValue={f.applicationStatus ?? ""}><Opt labels={APPLICATION_STATUS_LABELS} /></Select></F>
                <F label="Job ID"><Input name="jobId" defaultValue={f.jobId} placeholder="MIG-JOB-…" /></F>
              </div>
              <div className={two}>
                <F label="Applied from"><Input name="appliedFrom" type="date" defaultValue={toDateInputValue(f.appliedFrom)} /></F>
                <F label="Applied to"><Input name="appliedTo" type="date" defaultValue={toDateInputValue(f.appliedTo)} /></F>
              </div>
            </div>
          </FilterSection>

          <div className="sticky bottom-0 border-t bg-card p-4">
            <Button type="submit" className="w-full">Search candidates</Button>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {result ? <><span className="font-semibold text-foreground">{result.total.toLocaleString("en-US")}</span> matching candidate{result.total === 1 ? "" : "s"}</> : "Set filters and search"}
            </p>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Sort by
              <Select name="sort" defaultValue={f.sort} className="h-8 w-52">{Object.entries(SEARCH_SORTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
            </label>
          </div>
          {!result ? (
            <EmptyState icon={<FileSearch />} title="Find the right candidates" description='Example: Country "Canada", primary skill "Java", other skills "Spring Boot, AWS", experience 5–8.' />
          ) : result.candidates.length ? (
            <>
              <div className="space-y-3">
                {result.candidates.map((c) => <CandidateResultCard key={c.id} c={c} canViewDocuments={ctx.can(PERMISSIONS.DOCUMENT_VIEW)} canAddToJob={ctx.can(PERMISSIONS.APPLICATION_CREATE)} />)}
              </div>
              <Pagination basePath="/admin/search" params={params} page={page} pageSize={PAGE_SIZE} total={result.total} />
            </>
          ) : (
            <EmptyState icon={<FileSearch />} title="No candidates match all filters" description="Try removing a filter or widening the experience range." />
          )}
        </section>
      </LiveSearchForm>
    </>
  );
}
