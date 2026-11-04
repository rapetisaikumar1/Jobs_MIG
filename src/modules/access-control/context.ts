import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import { ForbiddenError } from "@/lib/action-result";
import { getAuthUser, getAuthUserStrict, isSessionTooOld } from "@/modules/auth/session";
import type { User as AuthUser } from "@supabase/supabase-js";
import { resolvePermissions, SYSTEM_ROLE_KEYS, type Permission } from "@/modules/access-control/permissions";

export type StaffContext = {
  user: { id: string; email: string; firstName: string; lastName: string };
  permissions: Set<Permission>;
  roleKeys: string[];
  roleNames: string[];
  isSuperAdmin: boolean;
  can: (permission: Permission) => boolean;
};

type StaffRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  type: string;
  is_active: boolean;
  role_id: string | null;
  role_key: string | null;
  role_name: string | null;
  permission_code: string | null;
};

type StaffLookup ={ status: "ok"; ctx: StaffContext } | { status: "anonymous" | "expired" | "not-staff" };

async function lookupStaff(authUser: AuthUser | null): Promise<StaffLookup> {
  if (!authUser) return { status: "anonymous" };
  if (isSessionTooOld(authUser, serverEnv.staffSessionMaxHours)) return { status: "expired" };

  // One round trip for the user, their roles and each role's permissions. (A nested Prisma
  // include issues one query per level, five in a row, which every admin page waited on.)
  const rows = await prisma.$queryRaw<StaffRow[]>`
    SELECT u.id, u.email, u.first_name, u.last_name, u.type::text AS type, u.is_active,
           r.id AS role_id, r.key AS role_key, r.name AS role_name, p.code AS permission_code
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE u.id = ${authUser.id}::uuid
    ORDER BY ur.assigned_at, r.name, p.code`;
  const user = rows[0];
  if (!user || user.type !== "STAFF" || !user.is_active) return { status: "not-staff" };

  const roles = new Map<string, { key: string | null; name: string; codes: string[] }>();
  for (const row of rows) {
    if (!row.role_id) continue;
    const role = roles.get(row.role_id) ?? { key: row.role_key, name: row.role_name!, codes: [] };
    if (row.permission_code) role.codes.push(row.permission_code);
    roles.set(row.role_id, role);
  }
  const permissions = resolvePermissions([...roles.values()].map((r) => r.codes));
  const roleKeys = [...roles.values()].map((r) => r.key).filter((k): k is string => !!k);
  return {
    status: "ok",
    ctx: {
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
      permissions,
      roleKeys,
      roleNames: [...roles.values()].map((r) => r.name),
      isSuperAdmin: roleKeys.includes(SYSTEM_ROLE_KEYS.SUPER_ADMIN),
      can: (permission) => permissions.has(permission),
    },
  };
}

/** Page renders and reads: identity from the verified session token (see getAuthUser). */
const loadStaff = cache(async () => lookupStaff(await getAuthUser()));
/** Server actions (writes): identity re-confirmed with the Auth server. */
const loadStaffStrict = cache(async () => lookupStaff(await getAuthUserStrict()));

/** Staff context confirmed with the Auth server, for server actions that change data. */
export async function getStaffContextStrict(): Promise<StaffContext | null> {
  const result = await loadStaffStrict();
  return result.status === "ok" ? result.ctx : null;
}

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
  const result = await loadStaffStrict();
  if (result.status !== "ok") throw new ForbiddenError("Your session has expired or you are not authorized.");
  for (const permission of allOf) {
    if (!result.ctx.can(permission)) throw new ForbiddenError();
  }
  return result.ctx;
}
