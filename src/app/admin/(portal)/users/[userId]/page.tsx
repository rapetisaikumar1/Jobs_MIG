import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/shared/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/forms/action-button";
import { EditStaffUserForm, SetPasswordForm } from "@/components/admin/access-forms";
import { formatDateTime, fullName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { uuid } from "@/lib/validation";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS, SYSTEM_ROLE_KEYS } from "@/modules/access-control/permissions";
import { setStaffUserActiveAction } from "@/modules/access-control/actions";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.USER_MANAGE);
  const id = uuid.safeParse((await params).userId);
  if (!id.success) notFound();
  const user = await prisma.user.findFirst({ where: { id: id.data, type: "STAFF" }, include: { roles: { include: { role: true } } } });
  if (!user) notFound();
  const [roles, tz] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    getViewerTimeZone(),
  ]);
  const assignable = roles.filter((r) => ctx.isSuperAdmin || r.key !== SYSTEM_ROLE_KEYS.SUPER_ADMIN || user.roles.some((ur) => ur.roleId === r.id));
  const isSelf = user.id === ctx.user.id;
  const targetIsSuperAdmin = user.roles.some((r) => r.role.key === SYSTEM_ROLE_KEYS.SUPER_ADMIN);
  const canSetPassword = user.isActive && (ctx.isSuperAdmin || !targetIsSuperAdmin);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={fullName(user)} size="md" />{fullName(user)} {user.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge tone="muted" dot>Deactivated</Badge>}</span>}
        description={`${user.email} · Added ${formatDateTime(user.createdAt, tz)}`}
        back={{ href: "/admin/users", label: "Users" }}
        actions={!isSelf && (
          <ActionButton
            variant={user.isActive ? "destructive" : "default"}
            confirm={user.isActive ? "Deactivate this user? They will be signed out and unable to sign in." : "Reactivate this user?"}
            action={setStaffUserActiveAction.bind(null, { userId: user.id, active: !user.isActive })}
          >
            {user.isActive ? "Deactivate" : "Reactivate"}
          </ActionButton>
        )}
      />
      {param(await searchParams, "notice") === "created" && <Alert variant="success">User created. {user.email} can sign in with the initial password you set.</Alert>}
      <Card>
        <CardHeader><CardTitle>Details and roles</CardTitle></CardHeader>
        <CardContent>
          <EditStaffUserForm
            userId={user.id}
            email={user.email}
            defaultValues={{ firstName: user.firstName, lastName: user.lastName, roleIds: user.roles.map((r) => r.roleId) }}
            roles={assignable.map((r) => ({ id: r.id, name: r.name, description: r.description }))}
          />
        </CardContent>
      </Card>
      {canSetPassword && (
        <Card>
          <CardHeader>
            <CardTitle>Set password</CardTitle>
            <CardDescription>Use this if the user forgot their password or needs a new one. Their current password stops working immediately.</CardDescription>
          </CardHeader>
          <CardContent><SetPasswordForm userId={user.id} /></CardContent>
        </Card>
      )}
    </div>
  );
}
