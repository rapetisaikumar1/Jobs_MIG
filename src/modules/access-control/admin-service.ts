import "server-only";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AppError, ForbiddenError } from "@/lib/action-result";
import type { StaffContext } from "@/modules/access-control/context";
import { LOCKED_ROLE_KEYS, SYSTEM_ROLE_KEYS } from "@/modules/access-control/permissions";

// ----- Staff users -----

async function validateRoleAssignment(ctx: StaffContext, roleIds: string[]) {
  const roles = await prisma.role.findMany({ where: { id: { in: roleIds } } });
  if (roles.length !== new Set(roleIds).size) throw new AppError("One or more roles no longer exist.");
  if (roles.some((r) => r.key === SYSTEM_ROLE_KEYS.CANDIDATE)) throw new AppError("The Candidate role cannot be assigned to staff.");
  if (roles.some((r) => r.key === SYSTEM_ROLE_KEYS.SUPER_ADMIN) && !ctx.isSuperAdmin) {
    throw new ForbiddenError("Only a Super Admin can grant the Super Admin role.");
  }
  return roles;
}

async function countOtherActiveSuperAdmins(excludeUserId: string) {
  return prisma.user.count({
    where: {
      id: { not: excludeUserId },
      type: "STAFF",
      isActive: true,
      roles: { some: { role: { key: SYSTEM_ROLE_KEYS.SUPER_ADMIN } } },
    },
  });
}

function authRedirect(next: string) {
  return `${serverEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/**
 * Creates an individual staff login. Supabase sends an invitation email; the
 * staff member sets their own password. No shared or admin-chosen passwords.
 */
export async function createStaffUser(
  ctx: StaffContext,
  input: { email: string; firstName: string; lastName: string; roleIds: string[]; groupIds: string[] },
) {
  await validateRoleAssignment(ctx, input.roleIds);
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new AppError("A user with this email already exists.");
  }

  const { data, error } = await supabaseAdmin().auth.admin.inviteUserByEmail(input.email, {
    redirectTo: authRedirect("/reset-password?welcome=1"),
    data: { account_type: "staff", first_name: input.firstName, last_name: input.lastName },
  });
  if (error || !data.user) throw new AppError(`Could not send the invitation: ${error?.message ?? "unknown error"}`);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: data.user.id,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          type: "STAFF",
          roles: { create: [...new Set(input.roleIds)].map((roleId) => ({ roleId })) },
          groups: { create: [...new Set(input.groupIds)].map((groupId) => ({ groupId })) },
        },
      });
      return user;
    });
  } catch (error) {
    // Keep Supabase Auth and the application database consistent.
    await supabaseAdmin().auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw error;
  }
}

export async function updateStaffUser(
  ctx: StaffContext,
  input: { userId: string; firstName: string; lastName: string; roleIds: string[]; groupIds: string[] },
) {
  const target = await prisma.user.findFirst({
    where: { id: input.userId, type: "STAFF" },
    include: { roles: { include: { role: true } } },
  });
  if (!target) throw new AppError("User not found.");
  const roles = await validateRoleAssignment(ctx, input.roleIds);

  const wasSuperAdmin = target.roles.some((r) => r.role.key === SYSTEM_ROLE_KEYS.SUPER_ADMIN);
  const remainsSuperAdmin = roles.some((r) => r.key === SYSTEM_ROLE_KEYS.SUPER_ADMIN);
  if (wasSuperAdmin && !remainsSuperAdmin) {
    if (!ctx.isSuperAdmin) throw new ForbiddenError("Only a Super Admin can remove the Super Admin role.");
    if (target.isActive && (await countOtherActiveSuperAdmins(target.id)) === 0) {
      throw new AppError("At least one active Super Admin is required.");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { firstName: input.firstName, lastName: input.lastName } });
    await tx.userRole.deleteMany({ where: { userId: target.id } });
    await tx.userRole.createMany({ data: [...new Set(input.roleIds)].map((roleId) => ({ userId: target.id, roleId })) });
    await tx.userGroup.deleteMany({ where: { userId: target.id } });
    if (input.groupIds.length) {
      await tx.userGroup.createMany({ data: [...new Set(input.groupIds)].map((groupId) => ({ userId: target.id, groupId })) });
    }
  });
}

/** Deactivation blocks the account in Supabase Auth (revoking sessions) and in the app. */
export async function setStaffUserActive(ctx: StaffContext, userId: string, active: boolean) {
  if (userId === ctx.user.id) throw new AppError("You cannot change the status of your own account.");
  const target = await prisma.user.findFirst({ where: { id: userId, type: "STAFF" }, include: { roles: { include: { role: true } } } });
  if (!target) throw new AppError("User not found.");
  const isSuperAdmin = target.roles.some((r) => r.role.key === SYSTEM_ROLE_KEYS.SUPER_ADMIN);
  if (isSuperAdmin && !ctx.isSuperAdmin) throw new ForbiddenError("Only a Super Admin can change a Super Admin account.");
  if (!active && isSuperAdmin && (await countOtherActiveSuperAdmins(target.id)) === 0) {
    throw new AppError("At least one active Super Admin is required.");
  }

  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  if (error) throw new AppError(`Could not update the login: ${error.message}`);
  await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
}

/** Secure account recovery: emails the user a one-time password reset link. */
export async function sendStaffPasswordReset(ctx: StaffContext, userId: string) {
  const target = await prisma.user.findFirst({ where: { id: userId, type: "STAFF" } });
  if (!target) throw new AppError("User not found.");
  if (!target.isActive) throw new AppError("Reactivate the user before sending a reset link.");
  const { error } = await supabaseAdmin().auth.resetPasswordForEmail(target.email, {
    redirectTo: authRedirect("/reset-password"),
  });
  if (error) throw new AppError(`Could not send the reset email: ${error.message}`);
}

// ----- Roles -----

export async function saveRole(
  ctx: StaffContext,
  roleId: string | null,
  input: { name: string; description?: string; permissions: string[] },
) {
  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError("Role not found.");
    if (role.key && LOCKED_ROLE_KEYS.includes(role.key)) throw new AppError(`The ${role.name} role cannot be edited.`);
  }
  const permissions = await prisma.permission.findMany({ where: { code: { in: input.permissions } } });

  return prisma.$transaction(async (tx) => {
    const role = roleId
      ? await tx.role.update({ where: { id: roleId }, data: { name: input.name, description: input.description ?? null } })
      : await tx.role.create({ data: { name: input.name, description: input.description ?? null } });
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length) {
      await tx.rolePermission.createMany({ data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    }
    return role;
  });
}

export async function deleteRole(ctx: StaffContext, roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
  if (!role) throw new AppError("Role not found.");
  if (role.isSystem) throw new AppError("Built-in roles cannot be deleted.");
  if (role._count.users > 0) throw new AppError("Remove this role from all users before deleting it.");
  await prisma.role.delete({ where: { id: roleId } });
}

// ----- Groups -----

export async function saveGroup(
  ctx: StaffContext,
  groupId: string | null,
  input: { name: string; description?: string; memberIds: string[] },
) {
  const memberIds = [...new Set(input.memberIds)];
  const staffCount = await prisma.user.count({ where: { id: { in: memberIds }, type: "STAFF" } });
  if (staffCount !== memberIds.length) throw new AppError("Groups can only contain staff users.");

  return prisma.$transaction(async (tx) => {
    const group = groupId
      ? await tx.group.update({ where: { id: groupId }, data: { name: input.name, description: input.description ?? null } })
      : await tx.group.create({ data: { name: input.name, description: input.description ?? null } });
    await tx.userGroup.deleteMany({ where: { groupId: group.id } });
    if (memberIds.length) await tx.userGroup.createMany({ data: memberIds.map((userId) => ({ userId, groupId: group.id })) });
    return group;
  });
}

export async function deleteGroup(ctx: StaffContext, groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new AppError("Group not found.");
  await prisma.group.delete({ where: { id: groupId } });
}
