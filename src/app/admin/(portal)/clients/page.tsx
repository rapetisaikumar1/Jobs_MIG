import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { FlashNotice } from "@/components/shared/flash-notice";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, redirectPastLastPage } from "@/components/shared/pagination";
import { LiveSearchForm } from "@/components/forms/live-search-form";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, param, parsePage, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { CLIENT_STATUS_FILTERS, type ClientStatusFilter } from "@/modules/clients/schemas";
import { listClients } from "@/modules/clients/queries";

export const metadata: Metadata = { title: "Clients" };

function jobSummary(jobs: { open: number; total: number }) {
  if (!jobs.total) return "No jobs";
  return `${jobs.open} open · ${jobs.total} total`;
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.CLIENT_VIEW);
  const canManage = ctx.can(PERMISSIONS.CLIENT_MANAGE);
  const params = await searchParams;
  const page = parsePage(params.page);
  const statusParam = param(params, "status");
  const status = statusParam && statusParam in CLIENT_STATUS_FILTERS ? (statusParam as ClientStatusFilter) : undefined;
  const filters = { q: param(params, "q"), status };
  const [{ total, clients }, tz] = await Promise.all([listClients(ctx, filters, page), getViewerTimeZone()]);
  const notice = param(params, "notice");
  const filtered = !!(filters.q || filters.status);

  redirectPastLastPage("/admin/clients", params, page, DEFAULT_PAGE_SIZE, total);
  return (
    <>
      <PageHeader
        title="Clients"
        description="The companies jobs are for. Client details are internal and never shown to candidates."
        actions={canManage && <Link href="/admin/clients/new" className={buttonVariants()}>Add client</Link>}
      />
      {notice === "deleted" && <FlashNotice><Alert variant="success" className="mb-4">Client deleted.</Alert></FlashNotice>}
      <LiveSearchForm className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-xs">
        <Input name="q" defaultValue={filters.q} placeholder="Name, contact or email" className="max-w-xs" aria-label="Search clients" />
        <Select name="status" defaultValue={status ?? ""} className="w-40" aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(CLIENT_STATUS_FILTERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </LiveSearchForm>
      {clients.length ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH className="hidden md:table-cell">Contact</TH>
                <TH className="hidden sm:table-cell">Jobs</TH>
                <TH>Status</TH>
                <TH className="hidden lg:table-cell">Updated</TH>
              </TR>
            </THead>
            <TBody>
              {clients.map((c) => (
                <TR key={c.id}>
                  <TD className="min-w-40">
                    <Link href={`/admin/clients/${c.id}`} className="font-medium [overflow-wrap:anywhere] hover:underline">{c.name}</Link>
                    {/* Narrow screens: the Contact / Jobs columns are hidden, so show them here. */}
                    {(c.contactName || c.contactEmail) && (
                      <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere] md:hidden">
                        {[c.contactName, c.contactEmail].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground sm:hidden">{jobSummary(c.jobs)}</span>
                  </TD>
                  <TD className="hidden md:table-cell">
                    {c.contactName || c.contactEmail ? (
                      <>
                        {c.contactName && <span className="block">{c.contactName}</span>}
                        {c.contactEmail && <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{c.contactEmail}</span>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD className="hidden whitespace-nowrap tabular-nums sm:table-cell">
                    {c.jobs.total ? jobSummary(c.jobs) : <span className="text-muted-foreground">—</span>}
                  </TD>
                  <TD>{c.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="muted">Inactive</Badge>}</TD>
                  <TD className="hidden whitespace-nowrap lg:table-cell">{formatDate(c.updatedAt, tz)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={<Building2 />}
          title={filtered ? "No clients found" : "No clients yet"}
          description={filtered ? "Adjust the search or status filter." : canManage ? "Add a client, then choose it when creating a job." : "Clients added by an administrator appear here."}
        />
      )}
      <Pagination basePath="/admin/clients" params={params} page={page} pageSize={DEFAULT_PAGE_SIZE} total={total} />
    </>
  );
}
