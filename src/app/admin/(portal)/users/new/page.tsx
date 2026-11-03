import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StaffUserForm } from "@/components/admin/access-forms";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS, SYSTEM_ROLE_KEYS } from "@/modules/access-control/permissions";

export const metadata: Metadata = { title: "Invite user" };

export default async function NewUserPage() {
  const ctx = await requireStaff(PERMISSIONS.USER_MANAGE);
  const [roles, groups] = await Promise.all([
    prisma.role.findMany({ where: { OR: [{ key: null }, { key: { not: SYSTEM_ROLE_KEYS.CANDIDATE } }] }, orderBy: { name: "asc" } }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
  ]);
  const assignable = roles.filter((r) => ctx.isSuperAdmin || r.key !== SYSTEM_ROLE_KEYS.SUPER_ADMIN);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Invite staff user" description="The user receives an email to set their own password." back={{ href: "/admin/users", label: "Users" }} />
      <Card><CardContent className="pt-6">
        <StaffUserForm
          defaultValues={{ email: "", firstName: "", lastName: "", roleIds: assignable.filter((r) => r.key === SYSTEM_ROLE_KEYS.RECRUITER).map((r) => r.id), groupIds: [] }}
          roles={assignable.map((r) => ({ id: r.id, name: r.name, description: r.description }))}
          groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description }))}
        />
      </CardContent></Card>
    </div>
  );
}
