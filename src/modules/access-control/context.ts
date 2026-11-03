import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import { ForbiddenError } from "@/lib/action-result";
import { getAuthUser, isSessionTooOld } from "@/modules/auth/session";
import { resolvePermissions, SYSTEM_ROLE_KEYS, type Permission } from "@/modules/access-control/permissions";

export type StaffContext = {
  user: { id: string; email: string; firstName: string; lastName: string };
  permissions: Set<Permission>;
  roleKeys: string[];
  roleNames: string[];
  groupIds: string[];
  isSuperAdmin: boolean;
  can: (permission: Permission) => boolean;
};

type StaffLookup = { status: "ok"; ctx: StaffContext } | { status: "anonymous" | "expired" | "not-staff" };

const loadStaff = cache(async (): Promise<StaffLookup> => {
  const authUser = await getAuthUser();
  if (!authUser) return { status: "anonymous" };
  if (isSessionTooOld(authUser, serverEnv.staffSessionMaxHours)) return { status: "expired" };

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      groups: { select: { groupId: true } },
    },
  });
  if (!user || user.type !== "STAFF" || !user.isActive) return { status: "not-staff" };

  const permissions = resolvePermissions(
    user.roles.map((ur) => ur.role.permissions.map((rp) => rp.permission.code)),
  );
  const roleKeys = user.roles.map((ur) => ur.role.key).filter((k): k is string => !!k);
  return {
    status: "ok",
    ctx: {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      permissions,
      roleKeys,
      roleNames: user.roles.map((ur) => ur.role.name),
      groupIds: user.groups.map((g) => g.groupId),
      isSuperAdmin: roleKeys.includes(SYSTEM_ROLE_KEYS.SUPER_ADMIN),
      can: (permission) => permissions.has(permission),
    },
  };
});

/** Staff context for the current request, or null. */
export async function getStaffContext(): Promise<StaffContext | null> {
  const result = await loadStaff();
  return result.status === "ok" ? result.ctx : null;
}

/** For admin pages: redirects when not signed in as active staff or lacking any of the permissions. */
export async function requireStaff(...anyOf: Permission[]): Promise<StaffContext> {
  const result = await loadStaff();
  if (result.status !== "ok") {
    if (result.status === "anonymous") redirect("/admin/login");
    if (result.status === "expired") redirect("/auth/signout?expired=1&to=admin");
    redirect("/admin/forbidden");
  }
  const { ctx } = result;
  if (anyOf.length && !anyOf.some((p) => ctx.can(p))) redirect("/admin/forbidden");
  return ctx;
}

/** For server actions and route handlers: throws ForbiddenError instead of redirecting. */
export async function requireStaffForAction(...allOf: Permission[]): Promise<StaffContext> {
  const result = await loadStaff();
  if (result.status !== "ok") throw new ForbiddenError("Your session has expired or you are not authorized.");
  for (const permission of allOf) {
    if (!result.ctx.can(permission)) throw new ForbiddenError();
  }
  return result.ctx;
}
