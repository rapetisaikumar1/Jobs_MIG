import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { RoleForm } from "@/components/admin/access-forms";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSION_DESCRIPTIONS, PERMISSION_GROUPS, PERMISSIONS } from "@/modules/access-control/permissions";

export const metadata: Metadata = { title: "New role" };

export default async function NewRolePage() {
  await requireStaff(PERMISSIONS.ROLE_MANAGE);
  return (
    <div className="max-w-5xl">
      <PageHeader title="New role" back={{ href: "/admin/roles", label: "Roles" }} />
      <Card><CardContent className="pt-6">
        <RoleForm defaultValues={{ name: "", description: "", permissions: [] }} groups={PERMISSION_GROUPS.map((g) => ({ label: g.label, permissions: g.permissions.map((code) => ({ code, description: PERMISSION_DESCRIPTIONS[code] })) }))} />
      </CardContent></Card>
    </div>
  );
}
