import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { RoleForm } from "@/components/admin/access-forms";
import { requireStaff } from "@/modules/access-control/context";
import { ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS, PERMISSIONS } from "@/modules/access-control/permissions";

export const metadata: Metadata = { title: "New role" };

export default async function NewRolePage() {
  await requireStaff(PERMISSIONS.ROLE_MANAGE);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New role" back={{ href: "/admin/roles", label: "Roles & groups" }} />
      <Card><CardContent className="pt-6">
        <RoleForm defaultValues={{ name: "", description: "", permissions: [] }} permissions={ALL_PERMISSIONS.map((p) => ({ id: p, name: p, description: PERMISSION_DESCRIPTIONS[p] }))} />
      </CardContent></Card>
    </div>
  );
}
