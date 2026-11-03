import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { GroupForm } from "@/components/admin/access-forms";
import { fullName } from "@/lib/format";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { listActiveStaff } from "@/modules/applications/queries";

export const metadata: Metadata = { title: "New group" };

export default async function NewGroupPage() {
  await requireStaff(PERMISSIONS.ROLE_MANAGE);
  const staff = await listActiveStaff();
  return (
    <div className="max-w-3xl">
      <PageHeader title="New group" back={{ href: "/admin/roles", label: "Roles & groups" }} />
      <Card><CardContent className="pt-6">
        <GroupForm defaultValues={{ name: "", description: "", memberIds: [] }} staff={staff.map((s) => ({ id: s.id, name: fullName(s) }))} />
      </CardContent></Card>
    </div>
  );
}
