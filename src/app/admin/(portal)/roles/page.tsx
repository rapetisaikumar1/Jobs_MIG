import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { param, type SearchParams } from "@/lib/pagination";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/forms/action-button";
import { deleteRoleAction } from "@/modules/access-control/actions";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/modules/access-control/context";
import { ALL_PERMISSIONS, PERMISSIONS } from "@/modules/access-control/permissions";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.ROLE_MANAGE);
  const canDelete = ctx.can(PERMISSIONS.ROLE_DELETE);
  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true, permissions: true } } },
  });
  const notice = param(await searchParams, "notice");

  async function remove(roleId: string) {
    "use server";
    const result = await deleteRoleAction({ roleId });
    // The deleted row disappears, so confirm on the list itself.
    if (result.ok) redirect("/admin/roles?notice=deleted");
    return result;
  }

  return (
    <>
      <PageHeader
        title="Roles"
        description="A role is a set of permissions. Every staff user has one or more roles."
        actions={<Link href="/admin/roles/new" className={buttonVariants()}>New role</Link>}
      />
      {notice === "deleted" && <Alert variant="success" className="mb-4">Role deleted.</Alert>}
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table>
          <THead><TR><TH>Role</TH><TH>Permissions</TH><TH>Users</TH>{canDelete && <TH className="text-right">Actions</TH>}</TR></THead>
          <TBody>
            {roles.map((r) => (
              <TR key={r.id}>
                <TD>
                  <Link href={`/admin/roles/${r.id}`} className="font-medium hover:underline">{r.name}</Link> {r.isSystem && <Badge tone="muted">Built-in</Badge>}
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </TD>
                <TD className="tabular-nums">{r._count.permissions} of {ALL_PERMISSIONS.length}</TD>
                <TD className="tabular-nums">{r._count.users}</TD>
                {canDelete && (
                  <TD className="text-right">
                    {r.isSystem ? (
                      <span className="text-muted-foreground" title="Built-in roles cannot be deleted">—</span>
                    ) : (
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={r._count.users > 0}
                        title={r._count.users > 0 ? `Assigned to ${r._count.users} user(s) — remove it from them first` : `Delete ${r.name}`}
                        confirm={`Delete the “${r.name}” role? This cannot be undone.`}
                        action={remove.bind(null, r.id)}
                      >
                        <Trash2 aria-hidden /> Delete
                      </ActionButton>
                    )}
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}
