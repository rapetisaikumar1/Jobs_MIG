import Link from "next/link";
import { Briefcase, ClipboardList, Eye, FileText, MapPin, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { SOURCE_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import { formatYears, fullName } from "@/lib/format";
import type { CandidateRow } from "@/components/candidates/candidate-table";
import type { ApplicationStatus } from "@prisma/client";

const iconButton = "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/** Search result card (LinkedIn Recruiter style): identity, key facts, skills, recent applications and actions. */
export function CandidateResultCard({ c }: { c: CandidateRow }) {
  const primary = c.skills.filter((s) => s.level === "PRIMARY").map((s) => s.skill.name);
  const other = c.skills.filter((s) => s.level !== "PRIMARY").map((s) => s.skill.name);
  const name = fullName(c);
  return (
    <article className="rounded-xl border bg-card p-5 shadow-xs transition-all hover:border-foreground/20 hover:shadow-md">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/candidates/${c.displayId}`} className="text-base font-semibold hover:underline">{name}</Link>
            <Badge tone={c.source === "JOB_PORTAL" ? "info" : "neutral"}>{SOURCE_LABELS[c.source]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{c.currentTitle ?? c.professionalTitle ?? "No title"} · {c.displayId}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Briefcase className="size-3.5" aria-hidden />{formatYears(c.totalExperienceYears)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden />{formatLocation(c.city, c.state, c.country)}</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/admin/candidates/${c.displayId}`} title="View profile" aria-label={`View profile of ${name}`} className={iconButton}><Eye className="size-4" /></Link>
          {c.defaultResumeId && (
            <a href={`/api/documents/${c.defaultResumeId}?inline=1`} target="_blank" rel="noopener noreferrer" title="Open resume" aria-label="Open resume" className={iconButton}><FileText className="size-4" /></a>
          )}
          <Link href={`/admin/candidates/${c.displayId}#applications`} title="Applications" aria-label="Applications" className={iconButton}><ClipboardList className="size-4" /></Link>
          <Link href={`/admin/candidates/${c.displayId}/add-to-job`} className={buttonVariants({ variant: "outline", size: "sm", className: "ml-1" })}>
            <UserPlus aria-hidden /> Add to job
          </Link>
        </div>
      </div>

      {(primary.length > 0 || other.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-1.5 sm:pl-14">
          {primary.map((s) => <span key={s} className="rounded-md border border-foreground/15 bg-foreground/[0.04] px-2 py-0.5 text-xs font-medium">{s}</span>)}
          {other.map((s) => <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{s}</span>)}
        </div>
      )}

      {c.applications?.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-xs sm:ml-14">
          <span className="text-muted-foreground">Applications:</span>
          {c.applications.map((a) => (
            <Link key={a.displayId} href={`/admin/applications/${a.displayId}`} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 hover:bg-muted" title={a.job.title}>
              <span className="font-medium">{a.job.displayId}</span>
              <ApplicationStatusBadge status={a.status as ApplicationStatus} />
            </Link>
          ))}
          {(c._count?.applications ?? 0) > c.applications.length && (
            <span className="text-muted-foreground">+{(c._count?.applications ?? 0) - c.applications.length} more</span>
          )}
        </div>
      ) : null}
    </article>
  );
}
