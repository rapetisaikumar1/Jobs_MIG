/**
 * Bootstraps the first Super Admin (or promotes an existing staff login).
 * Usage: npm run create-super-admin -- admin@company.com "First" "Last" "Initial-Password1"
 * The login is created directly (no invitation email) and can sign in immediately.
 */
import { PrismaClient } from "@prisma/client";
import { scriptSupabaseAdmin } from "./supabase-admin";
import { password as passwordRule } from "../src/lib/validation";
import { syncRolesAndPermissions } from "../src/modules/access-control/sync";

async function main() {
  const [emailArg, firstName = "Super", lastName = "Admin", password] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const usage = 'Usage: npm run create-super-admin -- email@company.com "First" "Last" "Initial-Password1"';
  if (!email || !email.includes("@")) throw new Error(usage);

  const prisma = new PrismaClient();
  const supabase = scriptSupabaseAdmin();
  await syncRolesAndPermissions(prisma);

  let user = await prisma.user.findUnique({ where: { email } });
  if (user && user.type !== "STAFF") throw new Error("That email belongs to a candidate account.");
  if (!user) {
    const check = passwordRule.safeParse(password ?? "");
    if (!check.success) throw new Error(`Provide a valid initial password (${check.error.issues[0].message}). ${usage}`);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { account_type: "staff", first_name: firstName, last_name: lastName },
    });
    if (error || !data.user) throw error ?? new Error("Could not create the login");
    user = await prisma.user.create({ data: { id: data.user.id, email, firstName, lastName, type: "STAFF" } });
    console.log(`Login created for ${email}. They can sign in at /admin/login.`);
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  console.log(`${email} is a Super Admin.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
