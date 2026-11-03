import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { CreateStaffUserForm } from "@/components/admin/access-forms";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS, SYSTEM_ROLE_KEYS } from "@/modules/access-control/permissions";

export const metadata: Metadata = { title: "Create user" };

export default async function NewUserPage() {
  const ctx = await requireStaff(PERMISSIONS.USER_MANAGE);
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
  const assignable = roles.filter((r) => ctx.isSuperAdmin || r.key !== SYSTEM_ROLE_KEYS.SUPER_ADMIN);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Create staff user" description="Creates an individual login that can sign in immediately." back={{ href: "/admin/users", label: "Users" }} />
      <Card><CardContent className="pt-6">
        <CreateStaffUserForm
          roles={assignable.map((r) => ({ id: r.id, name: r.name, description: r.description }))}
          defaultRoleIds={assignable.filter((r) => r.key === SYSTEM_ROLE_KEYS.RECRUITER).map((r) => r.id)}
        />
      </CardContent></Card>
    </div>
  );
}
