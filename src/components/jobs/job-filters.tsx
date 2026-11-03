import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPLOYMENT_TYPE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import type { PublicJobFilters } from "@/modules/jobs/queries";

function RadioGroup({ name, legend, options, value }: { name: string; legend: string; options: [string, string][]; value?: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="space-y-1">
        {options.map(([v, label]) => (
          <label key={v || "any"} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted has-[:checked]:font-medium">
            <input type="radio" name={name} value={v} defaultChecked={(value ?? "") === v} className="size-4 accent-primary" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Filter sidebar. Same GET parameters as before, so results and URLs are unchanged. */
export function JobFilterSidebar({ filters, skills }: { filters: PublicJobFilters; skills: string }) {
  const any = !!(filters.q || filters.location || filters.country || filters.workArrangement || filters.employmentType || skills);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="size-4" aria-hidden /> Filters</p>
        {any && <Link href="/jobs" className="text-xs font-medium text-muted-foreground hover:text-foreground">Clear all</Link>}
      </div>
      <div className="space-y-5">
        <RadioGroup name="country" legend="Country" value={filters.country} options={[["", "United States & Canada"], ["US", "United States"], ["CA", "Canada"]]} />
        <RadioGroup name="workArrangement" legend="Work arrangement" value={filters.workArrangement} options={[["", "Any"], ...Object.entries(WORK_ARRANGEMENT_LABELS)]} />
        <RadioGroup name="employmentType" legend="Employment type" value={filters.employmentType} options={[["", "Any"], ...Object.entries(EMPLOYMENT_TYPE_LABELS)]} />
        <div>
          <label htmlFor="skills" className="mb-2 block text-sm font-semibold">Skills</label>
          <Input id="skills" name="skills" defaultValue={skills} placeholder="e.g. Java, AWS" aria-label="Skills (comma separated)" />
        </div>
        <Button type="submit" variant="outline" className="w-full">Apply filters</Button>
      </div>
    </div>
  );
}
