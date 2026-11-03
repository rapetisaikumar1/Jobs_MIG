import type { PrismaClient } from "@prisma/client";
import {
  ALL_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  SYSTEM_ROLES,
  type SystemRoleKey,
} from "@/modules/access-control/permissions";

/**
 * Makes the database permission catalogue and built-in roles match the code.
 * Idempotent; run by the seed and the create-super-admin script after deploys.
 * Custom roles are never modified.
 */
export async function syncRolesAndPermissions(prisma: PrismaClient): Promise<void> {
  for (const code of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: PERMISSION_DESCRIPTIONS[code] },
      create: { code, description: PERMISSION_DESCRIPTIONS[code] },
    });
  }
  // Remove permissions that no longer exist in the catalogue (cascades from roles).
  await prisma.permission.deleteMany({ where: { code: { notIn: ALL_PERMISSIONS } } });
  const permissions = await prisma.permission.findMany();
  const idByCode = new Map(permissions.map((p) => [p.code, p.id]));

  for (const key of Object.keys(SYSTEM_ROLES) as SystemRoleKey[]) {
    const def = SYSTEM_ROLES[key];
    const role = await prisma.role.upsert({
      where: { key },
      update: { name: def.name, description: def.description, isSystem: true },
      create: { key, name: def.name, description: def.description, isSystem: true },
    });
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: def.permissions.map((code) => ({ roleId: role.id, permissionId: idByCode.get(code)! })),
      }),
    ]);
  }
}
