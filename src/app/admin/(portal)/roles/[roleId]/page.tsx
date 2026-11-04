import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/forms/action-button";
import { RoleForm } from "@/components/admin/access-forms";
import { prisma } from "@/lib/prisma";
import { uuid } from "@/lib/validation";
import { param, type SearchParams } from "@/lib/pagination";
import { requireStaff } from "@/modules/access-control/context";
import { LOCKED_ROLE_KEYS, PERMISSION_DESCRIPTIONS, PERMISSION_GROUPS, PERMISSIONS } from "@/modules/access-control/permissions";
import { deleteRoleAction } from "@/modules/access-control/actions";

export const metadata: Metadata = { title: "Role" };

export default async function RolePage({ params, searchParams }: { params: Promise<{ roleId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.ROLE_MANAGE);
  const id = uuid.safeParse((await params).roleId);
  if (!id.success) notFound();
  const role = await prisma.role.findUnique({ where: { id: id.data }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
  if (!role) notFound();
  const locked = !!role.key && LOCKED_ROLE_KEYS.includes(role.key);
  const canDelete = !role.isSystem && ctx.can(PERMISSIONS.ROLE_DELETE);
  const inUse = role._count.users > 0;

  async function remove() {
    "use server";
    const result = await deleteRoleAction({ roleId: id.data! });
    if (result.ok) redirect("/admin/roles?notice=deleted");
    return result;
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={role.name}
        description={`${role._count.users} user${role._count.users === 1 ? "" : "s"}`}
        back={{ href: "/admin/roles", label: "Roles" }}
        actions={canDelete && (
          <ActionButton
            variant="destructive"
            disabled={inUse}
            title={inUse ? "Remove this role from all users first" : undefined}
            confirm={`Delete the “${role.name}” role? This cannot be undone.`}
            action={remove}
          >
            <Trash2 aria-hidden /> Delete role
          </ActionButton>
        )}
      />
      {param(await searchParams, "notice") === "created" && <Alert variant="success" className="mb-4">Role {role.name} created.</Alert>}
      {locked && <Alert variant="neutral" className="mb-4">The {role.name} role is built in and cannot be changed.</Alert>}
      {canDelete && inUse && (
        <Alert variant="neutral" className="mb-4">
          This role is assigned to {role._count.users} user{role._count.users === 1 ? "" : "s"}. Remove it from them (Admin → Users) before deleting it.
        </Alert>
      )}
      <Card><CardContent className="pt-6">
        <RoleForm
          roleId={role.id}
          readOnly={locked}
          defaultValues={{ name: role.name, description: role.description ?? "", permissions: role.permissions.map((p) => p.permission.code) }}
          groups={PERMISSION_GROUPS.map((g) => ({ label: g.label, permissions: g.permissions.map((code) => ({ code, description: PERMISSION_DESCRIPTIONS[code] })) }))}
        />
      </CardContent></Card>
    </div>
  );
}
