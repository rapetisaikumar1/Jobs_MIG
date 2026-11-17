import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getAppUser, getAuthUser } from "@/modules/auth/session";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Staff accounts never see the job portal. The middleware already redirects stamped staff
  // sessions; this database check also covers sessions issued before the stamp existed.
  const authUser = await getAuthUser().catch(() => null);
  if (authUser && (await getAppUser(authUser.id))?.type === "STAFF") redirect("/admin/jobs");

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
