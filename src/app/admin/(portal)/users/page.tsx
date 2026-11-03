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
      include: { roles: { include: { role: true } }, groups: { include: { group: true } } },
    }),
    getViewerTimeZone(),
  ]);
  return (
    <>
      <PageHeader title="Staff users" description="Every staff member has an individual login. Shared accounts are not allowed." actions={<Link href="/admin/users/new" className={buttonVariants()}>Invite user</Link>} />
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table>
          <THead><TR><TH>Name</TH><TH>Email</TH><TH>Roles</TH><TH>Groups</TH><TH>Status</TH><TH>Added</TH></TR></THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD><span className="flex items-center gap-2.5"><Avatar name={fullName(u)} size="xs" /><Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{fullName(u)}</Link></span></TD>
                <TD>{u.email}</TD>
                <TD>{u.roles.map((r) => r.role.name).join(", ") || "—"}</TD>
                <TD className="max-w-60 truncate">{u.groups.map((g) => g.group.name).join(", ") || "—"}</TD>
                <TD>{u.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="muted">Deactivated</Badge>}</TD>
                <TD>{formatDate(u.createdAt, tz)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}
