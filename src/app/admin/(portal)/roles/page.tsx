import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";

export const metadata: Metadata = { title: "Roles & groups" };

export default async function RolesPage() {
  await requireStaff(PERMISSIONS.ROLE_MANAGE);
  const [roles, groups] = await Promise.all([
    prisma.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], include: { _count: { select: { users: true, permissions: true } } } }),
    prisma.group.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true, jobs: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Roles & groups" description="Roles grant permissions. Groups organize staff and give access to the jobs assigned to them." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Roles</CardTitle><Link href="/admin/roles/new" className={buttonVariants({ size: "sm" })}>New role</Link></CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <THead><TR><TH>Role</TH><TH>Permissions</TH><TH>Users</TH></TR></THead>
              <TBody>
                {roles.map((r) => (
                  <TR key={r.id}>
                    <TD><Link href={`/admin/roles/${r.id}`} className="font-medium hover:underline">{r.name}</Link> {r.isSystem && <Badge tone="muted">Built-in</Badge>}<p className="text-xs text-muted-foreground">{r.description}</p></TD>
                    <TD className="tabular-nums">{r._count.permissions}</TD>
                    <TD className="tabular-nums">{r.key === "CANDIDATE" ? "—" : r._count.users}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Groups</CardTitle><Link href="/admin/roles/groups/new" className={buttonVariants({ size: "sm" })}>New group</Link></CardHeader>
          <CardContent className="px-0 pb-0">
            {groups.length ? (
              <Table>
                <THead><TR><TH>Group</TH><TH>Members</TH><TH>Jobs</TH></TR></THead>
                <TBody>
                  {groups.map((g) => (
                    <TR key={g.id}>
                      <TD><Link href={`/admin/roles/groups/${g.id}`} className="font-medium hover:underline">{g.name}</Link><p className="text-xs text-muted-foreground">{g.description}</p></TD>
                      <TD className="tabular-nums">{g._count.users}</TD>
                      <TD className="tabular-nums">{g._count.jobs}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : <p className="px-5 pb-5 text-sm text-muted-foreground">No groups yet.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
