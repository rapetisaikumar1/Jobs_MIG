import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/forms/action-button";
import { StaffUserForm } from "@/components/admin/access-forms";
import { formatDateTime, fullName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { param, type SearchParams } from "@/lib/pagination";
import { getViewerTimeZone } from "@/lib/request";
import { uuid } from "@/lib/validation";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS, SYSTEM_ROLE_KEYS } from "@/modules/access-control/permissions";
import { sendStaffPasswordResetAction, setStaffUserActiveAction } from "@/modules/access-control/actions";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireStaff(PERMISSIONS.USER_MANAGE);
  const id = uuid.safeParse((await params).userId);
  if (!id.success) notFound();
  const user = await prisma.user.findFirst({ where: { id: id.data, type: "STAFF" }, include: { roles: true, groups: true } });
  if (!user) notFound();
  const [roles, groups, tz] = await Promise.all([
    prisma.role.findMany({ where: { OR: [{ key: null }, { key: { not: SYSTEM_ROLE_KEYS.CANDIDATE } }] }, orderBy: { name: "asc" } }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
    getViewerTimeZone(),
  ]);
  const assignable = roles.filter((r) => ctx.isSuperAdmin || r.key !== SYSTEM_ROLE_KEYS.SUPER_ADMIN || user.roles.some((ur) => ur.roleId === r.id));
  const isSelf = user.id === ctx.user.id;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={<span className="flex items-center gap-3">{fullName(user)} {user.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="muted">Deactivated</Badge>}</span>}
        description={`${user.email} · Added ${formatDateTime(user.createdAt, tz)}`}
        back={{ href: "/admin/users", label: "Users" }}
        actions={!isSelf && (
          <>
            {user.isActive && <ActionButton variant="outline" confirm="Send a password reset email to this user?" action={sendStaffPasswordResetAction.bind(null, { userId: user.id })}>Send password reset</ActionButton>}
            <ActionButton
              variant={user.isActive ? "destructive" : "default"}
              confirm={user.isActive ? "Deactivate this user? They will be signed out and unable to sign in." : "Reactivate this user?"}
              action={setStaffUserActiveAction.bind(null, { userId: user.id, active: !user.isActive })}
            >
              {user.isActive ? "Deactivate" : "Reactivate"}
            </ActionButton>
          </>
        )}
      />
      {param(await searchParams, "notice") === "invited" && <Alert variant="success" className="mb-4">Invitation sent to {user.email}.</Alert>}
      <Card>
        <CardHeader><CardTitle>Details, roles and groups</CardTitle></CardHeader>
        <CardContent>
          <StaffUserForm
            userId={user.id}
            defaultValues={{ email: user.email, firstName: user.firstName, lastName: user.lastName, roleIds: user.roles.map((r) => r.roleId), groupIds: user.groups.map((g) => g.groupId) }}
            roles={assignable.map((r) => ({ id: r.id, name: r.name, description: r.description }))}
            groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
