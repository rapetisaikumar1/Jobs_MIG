"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { uuid } from "@/lib/validation";
import { requireStaffForAction } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { clientSchema, type ClientFormValues } from "@/modules/clients/schemas";
import { createClient, deleteClient, setClientActive, updateClient } from "@/modules/clients/service";

/** Client names also show on jobs, case files and applications (filters, details). */
function revalidateClientPages() {
  revalidatePath("/admin/sources", "layout");
  revalidatePath("/admin/jobs", "layout");
  revalidatePath("/admin/case-files", "layout");
  revalidatePath("/admin/applications", "layout");
}

export async function createClientAction(values: ClientFormValues): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.CLIENT_MANAGE);
    const parsed = clientSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const client = await createClient(ctx, parsed.data);
    revalidateClientPages();
    return ok({ id: client.id }, `Source ${client.name} created.`);
  });
}

export async function updateClientAction(clientId: string, values: ClientFormValues): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaffForAction(PERMISSIONS.CLIENT_MANAGE);
    const id = uuid.parse(clientId);
    const parsed = clientSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await updateClient(id, parsed.data);
    revalidateClientPages();
    return ok(undefined, "Source updated.");
  });
}

const clientRef = z.object({ clientId: uuid, active: z.boolean() });

export async function setClientActiveAction(values: { clientId: string; active: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaffForAction(PERMISSIONS.CLIENT_MANAGE);
    const { clientId, active } = clientRef.parse(values);
    const client = await setClientActive(clientId, active);
    revalidateClientPages();
    return ok(undefined, active ? `${client.name} reactivated.` : `${client.name} deactivated. It can't be chosen for new jobs.`);
  });
}

export async function deleteClientAction(values: { clientId: string }): Promise<ActionResult> {
  return runAction(async () => {
    await requireStaffForAction(PERMISSIONS.CLIENT_MANAGE);
    const client = await deleteClient(uuid.parse(values.clientId));
    revalidateClientPages();
    return ok(undefined, `Source ${client.name} deleted.`);
  });
}
