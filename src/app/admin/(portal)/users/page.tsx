import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Avatar } from "@/components/shared/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { formatDate, fullName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getViewerTimeZone } from "@/lib/request";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requireStaff(PERMISSIONS.USER_MANAGE);
  const [users, tz] = await Promise.all([
    prisma.user.findMany({
      where: { type: "STAFF" },
      orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
      include: { roles: { include: { role: true } } },
    }),
    getViewerTimeZone(),
  ]);
  return (
    <>
      <PageHeader title="Staff users" description="Every staff member has an individual login. Shared accounts are not allowed." actions={<Link href="/admin/users/new" className={buttonVariants()}>Create user</Link>} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH className="hidden md:table-cell">Email</TH>
              <TH className="hidden sm:table-cell">Roles</TH>
              <TH>Status</TH>
              <TH className="hidden lg:table-cell">Added</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => {
              const roles = u.roles.map((r) => r.role.name).join(", ") || "—";
              return (
                <TR key={u.id}>
                  <TD>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={fullName(u)} size="xs" />
                      <span className="min-w-0">
                        <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{fullName(u)}</Link>
                        {/* Narrow screens: the Email / Roles columns are hidden, so show them here. */}
                        <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere] md:hidden">{u.email}</span>
                        <span className="block text-xs text-muted-foreground sm:hidden">{roles}</span>
                      </span>
                    </span>
                  </TD>
                  <TD className="hidden [overflow-wrap:anywhere] md:table-cell">{u.email}</TD>
                  <TD className="hidden sm:table-cell">{roles}</TD>
                  <TD>{u.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="muted">Deactivated</Badge>}</TD>
                  <TD className="hidden whitespace-nowrap lg:table-cell">{formatDate(u.createdAt, tz)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
  );
}
