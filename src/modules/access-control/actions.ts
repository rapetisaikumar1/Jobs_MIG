"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { uuid } from "@/lib/validation";
import { requireStaffForAction } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import {
  groupSchema,
  roleSchema,
  staffUserCreateSchema,
  staffUserUpdateSchema,
  type GroupFormValues,
  type RoleFormValues,
  type StaffUserCreateFormValues,
  type StaffUserUpdateFormValues,
} from "@/modules/access-control/schemas";
import {
  createStaffUser,
  deleteGroup,
  deleteRole,
  saveGroup,
  saveRole,
  sendStaffPasswordReset,
  setStaffUserActive,
  updateStaffUser,
} from "@/modules/access-control/admin-service";

export async function createStaffUserAction(values: StaffUserCreateFormValues): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.USER_MANAGE);
    const parsed = staffUserCreateSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const user = await createStaffUser(ctx, parsed.data);
    revalidatePath("/admin/users");
    return ok({ id: user.id }, `Invitation sent to ${user.email}.`);
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

export async function sendStaffPasswordResetAction(values: { userId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.USER_MANAGE);
    const { userId } = userRef.parse(values);
    await sendStaffPasswordReset(ctx, userId);
    return ok(undefined, "Password reset email sent.");
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
    const ctx = await requireStaffForAction(PERMISSIONS.ROLE_MANAGE);
    await deleteRole(ctx, uuid.parse(values.roleId));
    revalidatePath("/admin/roles");
    return ok(undefined, "Role deleted.");
  });
}

export async function saveGroupAction(groupId: string | null, values: GroupFormValues): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.ROLE_MANAGE);
    const parsed = groupSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const group = await saveGroup(ctx, groupId ? uuid.parse(groupId) : null, parsed.data);
    revalidatePath("/admin", "layout");
    return ok({ id: group.id }, "Group saved.");
  });
}

export async function deleteGroupAction(values: { groupId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.ROLE_MANAGE);
    await deleteGroup(ctx, uuid.parse(values.groupId));
    revalidatePath("/admin", "layout");
    return ok(undefined, "Group deleted.");
  });
}
