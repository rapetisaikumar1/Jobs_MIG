import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/forms/action-button";
import { GroupForm } from "@/components/admin/access-forms";
import { fullName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { uuid } from "@/lib/validation";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { deleteGroupAction } from "@/modules/access-control/actions";

export const metadata: Metadata = { title: "Group" };

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  await requireStaff(PERMISSIONS.ROLE_MANAGE);
  const id = uuid.safeParse((await params).groupId);
  if (!id.success) notFound();
  const group = await prisma.group.findUnique({ where: { id: id.data }, include: { users: true, _count: { select: { jobs: true } } } });
  if (!group) notFound();
  const staff = await prisma.user.findMany({
    where: { type: "STAFF", OR: [{ isActive: true }, { id: { in: group.users.map((u) => u.userId) } }] },
    orderBy: { firstName: "asc" },
  });

  async function remove() {
    "use server";
    const result = await deleteGroupAction({ groupId: id.data! });
    if (result.ok) redirect("/admin/roles");
    return result;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={group.name}
        description={`${group.users.length} members · ${group._count.jobs} jobs`}
        back={{ href: "/admin/roles", label: "Roles & groups" }}
        actions={<ActionButton variant="destructive" confirm="Delete this group? Members lose access to jobs assigned only to this group." action={remove}>Delete group</ActionButton>}
      />
      <Card><CardContent className="pt-6">
        <GroupForm
          groupId={group.id}
          defaultValues={{ name: group.name, description: group.description ?? "", memberIds: group.users.map((u) => u.userId) }}
          staff={staff.map((s) => ({ id: s.id, name: `${fullName(s)}${s.isActive ? "" : " (deactivated)"}` }))}
        />
      </CardContent></Card>
    </div>
  );
}
