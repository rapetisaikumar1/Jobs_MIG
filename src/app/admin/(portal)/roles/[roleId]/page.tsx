import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/forms/action-button";
import { RoleForm } from "@/components/admin/access-forms";
import { prisma } from "@/lib/prisma";
import { uuid } from "@/lib/validation";
import { requireStaff } from "@/modules/access-control/context";
import { ALL_PERMISSIONS, LOCKED_ROLE_KEYS, PERMISSION_DESCRIPTIONS, PERMISSIONS } from "@/modules/access-control/permissions";
import { deleteRoleAction } from "@/modules/access-control/actions";

export const metadata: Metadata = { title: "Role" };

export default async function RolePage({ params }: { params: Promise<{ roleId: string }> }) {
  await requireStaff(PERMISSIONS.ROLE_MANAGE);
  const id = uuid.safeParse((await params).roleId);
  if (!id.success) notFound();
  const role = await prisma.role.findUnique({ where: { id: id.data }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
  if (!role) notFound();
  const locked = !!role.key && LOCKED_ROLE_KEYS.includes(role.key);

  async function remove() {
    "use server";
    const result = await deleteRoleAction({ roleId: id.data! });
    if (result.ok) redirect("/admin/roles");
    return result;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={role.name}
        description={`${role._count.users} user${role._count.users === 1 ? "" : "s"}`}
        back={{ href: "/admin/roles", label: "Roles & groups" }}
        actions={!role.isSystem && <ActionButton variant="destructive" confirm="Delete this role?" action={remove}>Delete role</ActionButton>}
      />
      {locked && <Alert variant="neutral" className="mb-4">The {role.name} role is built in and cannot be changed.</Alert>}
      <Card><CardContent className="pt-6">
        <RoleForm
          roleId={role.id}
          readOnly={locked}
          defaultValues={{ name: role.name, description: role.description ?? "", permissions: role.permissions.map((p) => p.permission.code) }}
          permissions={ALL_PERMISSIONS.map((p) => ({ id: p, name: p, description: PERMISSION_DESCRIPTIONS[p] }))}
        />
      </CardContent></Card>
    </div>
  );
}
