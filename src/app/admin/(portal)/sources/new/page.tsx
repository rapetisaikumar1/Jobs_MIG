import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ClientForm } from "@/components/admin/client-form";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { EMPTY_CLIENT } from "@/modules/clients/schemas";

export const metadata: Metadata = { title: "Add source" };

export default async function NewClientPage() {
  await requireStaff(PERMISSIONS.CLIENT_MANAGE);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add source" description="Source details are internal and never shown to candidates." back={{ href: "/admin/sources", label: "Sources" }} />
      <Card><CardContent className="pt-6">
        <ClientForm defaultValues={EMPTY_CLIENT} />
      </CardContent></Card>
    </div>
  );
}
