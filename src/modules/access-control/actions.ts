"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { uuid } from "@/lib/validation";
import { requireStaffForAction } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import {
  roleSchema,
  staffPasswordSchema,
  staffUserCreateSchema,
  staffUserUpdateSchema,
  type RoleFormValues,
  type StaffPasswordFormValues,
  type StaffUserCreateFormValues,
  type StaffUserUpdateFormValues,
} from "@/modules/access-control/schemas";
import {
  createStaffUser,
  deleteRole,
  saveRole,
  setStaffUserActive,
  setStaffUserPassword,
  updateStaffUser,
} from "@/modules/access-control/admin-service";

export async function createStaffUserAction(values: StaffUserCreateFormValues): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.USER_MANAGE);
    const parsed = staffUserCreateSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const user = await createStaffUser(ctx, parsed.data);
    revalidatePath("/admin/users");
    return ok({ id: user.id }, `User ${user.email} created. They can sign in now.`);
  });
}

export async function updateStaffUserAction(values: StaffUserUpdateFormValues): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.USER_MANAGE);
    const parsed = staffUserUpdateSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await updateStaffUser(ctx, parsed.data);
    revalidatePath("/admin", "layout");
    return ok(undefined, "User updated.");
  });
}

const userRef = z.object({ userId: uuid });

export async function setStaffUserActiveAction(values: { userId: string; active: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.USER_MANAGE);
    const { userId } = userRef.parse(values);
    await setStaffUserActive(ctx, userId, values.active === true);
    revalidatePath("/admin/users", "layout");
    return ok(undefined, values.active ? "User reactivated." : "User deactivated.");
  });
}

export async function setStaffUserPasswordAction(values: StaffPasswordFormValues): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.USER_MANAGE);
    const parsed = staffPasswordSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await setStaffUserPassword(ctx, parsed.data.userId, parsed.data.password);
    return ok(undefined, "Password updated. Share it with the user securely.");
  });
}

export async function saveRoleAction(roleId: string | null, values: RoleFormValues): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.ROLE_MANAGE);
    const parsed = roleSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const role = await saveRole(ctx, roleId ? uuid.parse(roleId) : null, parsed.data);
    revalidatePath("/admin", "layout");
    return ok({ id: role.id }, "Role saved.");
  });
}

export async function deleteRoleAction(values: { roleId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.ROLE_DELETE);
    const role = await deleteRole(ctx, uuid.parse(values.roleId));
    revalidatePath("/admin", "layout");
    return ok(undefined, `Role “${role.name}” deleted.`);
  });
}
