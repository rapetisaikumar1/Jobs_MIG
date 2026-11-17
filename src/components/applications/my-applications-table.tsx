import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  displayId: string;
  status: ApplicationStatus;
  appliedAt: Date;
  job: { displayId: string; title: string; status: string };
};

/** Candidate-facing table: shows candidate-facing statuses only. */
export function MyApplicationsTable({ rows, timeZone }: { rows: Row[]; timeZone: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <Table>
        <THead>
          <TR>
            <TH className="hidden sm:table-cell">Application ID</TH>
            <TH>Job title</TH>
            <TH className="hidden sm:table-cell">Applied date</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id}>
              <TD className="hidden whitespace-nowrap font-medium sm:table-cell">
                <Link href={`/candidate/applications/${row.displayId}`} className="hover:underline">{row.displayId}</Link>
              </TD>
              <TD className="min-w-40">
                {row.job.title}
                {/* On phones the ID and date columns are hidden; show them under the title instead. */}
                <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                  {row.displayId} · {formatDate(row.appliedAt, timeZone)}
                </span>
              </TD>
              <TD className="hidden whitespace-nowrap sm:table-cell">{formatDate(row.appliedAt, timeZone)}</TD>
              <TD><ApplicationStatusBadge status={row.status} audience="candidate" /></TD>
              <TD className="whitespace-nowrap text-right">
                <span className="inline-flex items-center gap-1">
                  {(row.job.status === "PUBLISHED" || row.job.status === "CLOSED") && (
                    <Link href={`/jobs/${row.job.displayId}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>View job</Link>
                  )}
                  <Link href={`/candidate/applications/${row.displayId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Details</Link>
                </span>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
