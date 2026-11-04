import Link from "next/link";
import { Briefcase, CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EMPLOYMENT_TYPE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import {
  decimalToNumber,
  formatCalendarDate,
  formatCompensation,
  formatDate,
  formatExperienceRange,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicJobCard } from "@/modules/jobs/queries";

export function publicCompensation(job: Pick<PublicJobCard, "salaryPublic" | "compensationMin" | "compensationMax" | "currency" | "compensationType">) {
  if (!job.salaryPublic) return null;
  return formatCompensation(decimalToNumber(job.compensationMin), decimalToNumber(job.compensationMax), job.currency, job.compensationType);
}

/** Square tile shown beside a job. */
export function JobTile({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-lg border bg-surface text-foreground", size === "lg" ? "size-16 rounded-xl" : "size-10")} aria-hidden>
      <Briefcase className={size === "lg" ? "size-7" : "size-[18px]"} strokeWidth={1.75} />
    </span>
  );
}

export function JobPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground/80", className)}>{children}</span>;
}

/** Compact single-row job listing (Indeed/LinkedIn style): three short lines per job. */
export function JobCard({ job, timeZone, applied }: { job: PublicJobCard; timeZone: string; applied?: boolean }) {
  const pay = publicCompensation(job);
  const required = job.skills.filter((s) => s.type === "REQUIRED").map((s) => s.skill.name);
  return (
    <article className="group relative flex min-w-0 gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-xs transition-all hover:border-foreground/20 hover:shadow-md">
      <JobTile />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-[15px] font-semibold leading-snug">
            <Link href={`/jobs/${job.displayId}`} title={job.title} className="after:absolute after:inset-0 group-hover:underline">
              {job.title}
            </Link>
          </h3>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {job.isFeatured && <Badge tone="dark" className="px-1.5 text-[11px]">Featured</Badge>}
            {applied ? (
              <Badge tone="info" dot className="px-1.5 text-[11px]">Already applied</Badge>
            ) : (
              <Badge tone="success" dot className="px-1.5 text-[11px]">Open</Badge>
            )}
          </div>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span>{formatLocation(job.city, job.state, job.country)}</span>
          <span aria-hidden>·</span>
          <span>{WORK_ARRANGEMENT_LABELS[job.workArrangement]}</span>
          <span aria-hidden>·</span>
          <span>{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</span>
          <span aria-hidden>·</span>
          <span>{formatExperienceRange(job.minExperience, job.maxExperience)}</span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          {pay && <JobPill className="bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{pay}</JobPill>}
          {required.length > 0 && <span className="min-w-0 truncate text-muted-foreground">{required.slice(0, 6).join(" · ")}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />Posted {formatDate(job.publishedAt, timeZone)}</span>
            {job.applicationDeadline && <span className="hidden sm:inline">Apply by {formatCalendarDate(job.applicationDeadline, "medium")}</span>}
            <span className="hidden font-mono text-[11px] md:inline">{job.displayId}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
