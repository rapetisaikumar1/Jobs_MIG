import Link from "next/link";
import { ClipboardList, Eye, FileText, UserPlus } from "lucide-react";
import type { Source } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SOURCE_LABELS } from "@/config/options";
import { formatLocation, regionName } from "@/config/locations";
import { formatYears, fullName } from "@/lib/format";

export type CandidateRow = {
  id: string;
  displayId: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string | null;
  state: string | null;
  country: string;
  source: Source;
  currentTitle: string | null;
  professionalTitle: string | null;
  totalExperienceYears: number | null;
  defaultResumeId: string | null;
  skills: { level: string; skill: { name: string } }[];
  applications?: { displayId: string; status: string; job: { displayId: string; title: string } }[];
  _count?: { applications: number };
};

const iconButton = "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/** Candidate results with quick actions (profile, resume, applications, add to job). */
export function CandidateTable({
  rows,
  showActions = true,
  canViewDocuments = true,
  canAddToJob = true,
}: {
  rows: CandidateRow[];
  showActions?: boolean;
  canViewDocuments?: boolean;
  canAddToJob?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <Table className="[&_td]:px-3 [&_th]:px-3">
        <THead>
          <TR>
            <TH>Candidate</TH>
            <TH>Skills</TH>
            <TH>Experience</TH>
            <TH>Location</TH>
            <TH>Source</TH>
            {showActions && <TH className="text-right">Actions</TH>}
          </TR>
        </THead>
        <TBody>
          {rows.map((c) => {
            const primary = c.skills.filter((s) => s.level === "PRIMARY").map((s) => s.skill.name);
            const skills = [...primary, ...c.skills.filter((s) => s.level !== "PRIMARY").map((s) => s.skill.name)];
            return (
              <TR key={c.id} className="align-top">
                <TD className="min-w-56">
                  <div className="flex items-start gap-3">
                  <Avatar name={fullName(c)} />
                  <div className="min-w-0">
                  <Link href={`/admin/candidates/${c.displayId}`} className="font-medium hover:underline">{fullName(c)}</Link>
                  <p className="truncate text-xs text-muted-foreground">{c.currentTitle ?? c.professionalTitle ?? "No title"}</p>
                  <p className="whitespace-nowrap text-xs text-muted-foreground">{c.displayId}</p>
                  {c.applications?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Applied:{" "}
                      {c.applications.map((a, i) => (
                        <span key={a.displayId}>
                          {i > 0 && ", "}
                          <Link href={`/admin/applications/${a.displayId}`} className="underline" title={a.job.title}>{a.job.displayId}</Link>
                        </span>
                      ))}
                      {(c._count?.applications ?? 0) > c.applications.length && ` +${(c._count?.applications ?? 0) - c.applications.length}`}
                    </p>
                  ) : null}
                  </div>
                  </div>
                </TD>
                <TD className="min-w-48 max-w-64">
                  <div className="flex flex-wrap gap-1">
                    {skills.slice(0, 4).map((s, i) => (
                      <span key={s} className={i < primary.length ? "rounded-md border border-foreground/15 bg-foreground/[0.04] px-1.5 py-0.5 text-[11px] font-medium" : "rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"}>{s}</span>
                    ))}
                    {skills.length > 4 && <span className="self-center text-[11px] text-muted-foreground" title={skills.slice(4).join(", ")}>+{skills.length - 4} more</span>}
                  </div>
                </TD>
                <TD className="whitespace-nowrap">{formatYears(c.totalExperienceYears)}</TD>
                <TD className="min-w-32 max-w-44" title={formatLocation(c.city, c.state, c.country)}>{[c.city, c.state ? regionName(c.country, c.state) : null].filter(Boolean).join(", ") || c.country}</TD>
                <TD><Badge tone={c.source === "JOB_PORTAL" ? "info" : "neutral"}>{SOURCE_LABELS[c.source]}</Badge></TD>
                {showActions && (
                  <TD className="whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/candidates/${c.displayId}`} title="View profile" aria-label={`View profile of ${fullName(c)}`} className={iconButton}>
                        <Eye className="size-4" />
                      </Link>
                      {canViewDocuments && c.defaultResumeId && (
                        <a href={`/api/documents/${c.defaultResumeId}?inline=1`} target="_blank" rel="noopener noreferrer" title="Open resume" aria-label="Open resume" className={iconButton}>
                          <FileText className="size-4" />
                        </a>
                      )}
                      <Link href={`/admin/candidates/${c.displayId}#applications`} title="Applications" aria-label="Applications" className={iconButton}>
                        <ClipboardList className="size-4" />
                      </Link>
                      {canAddToJob && (
                        <Link href={`/admin/candidates/${c.displayId}/add-to-job`} className={buttonVariants({ variant: "outline", size: "sm", className: "ml-1" })}>
                          <UserPlus aria-hidden /> Add to job
                        </Link>
                      )}
                    </div>
                  </TD>
                )}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
