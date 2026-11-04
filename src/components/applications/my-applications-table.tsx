import Link from "next/link";
import type { ApplicationStatus } from "@prisma/client";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ApplicationStatusBadge } from "@/components/shared/status-badges";
import { formatDate } from "@/lib/format";

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
            <TH>Application ID</TH>
            <TH>Job title</TH>
            <TH>Applied date</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id}>
              <TD className="font-medium">
                <Link href={`/candidate/applications/${row.displayId}`} className="hover:underline">{row.displayId}</Link>
              </TD>
              <TD>{row.job.title}</TD>
              <TD className="whitespace-nowrap">{formatDate(row.appliedAt, timeZone)}</TD>
              <TD><ApplicationStatusBadge status={row.status} audience="candidate" /></TD>
              <TD className="whitespace-nowrap text-right">
                <span className="inline-flex items-center gap-1">
                  {(row.job.status === "PUBLISHED" || row.job.status === "CLOSED") && (
                    <Link href={`/jobs/${row.job.displayId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>View job</Link>
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
