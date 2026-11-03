/**
 * Bootstraps the first Super Admin (or promotes an existing staff login).
 * Usage: npm run create-super-admin -- admin@company.com "First" "Last"
 * The user receives a Supabase invitation email to set their password.
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { syncRolesAndPermissions } from "../src/modules/access-control/sync";

async function main() {
  const [emailArg, firstName = "Super", lastName = "Admin"] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error('Usage: npm run create-super-admin -- email@company.com "First" "Last"');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const prisma = new PrismaClient();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  await syncRolesAndPermissions(prisma);

  let user = await prisma.user.findUnique({ where: { email } });
  if (user && user.type !== "STAFF") throw new Error("That email belongs to a candidate account.");
  if (!user) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent("/reset-password?welcome=1")}`,
      data: { account_type: "staff" },
    });
    if (error || !data.user) throw error ?? new Error("Invite failed");
    user = await prisma.user.create({ data: { id: data.user.id, email, firstName, lastName, type: "STAFF" } });
    console.log(`Invitation email sent to ${email}.`);
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
  console.error(error);
  process.exit(1);
});
