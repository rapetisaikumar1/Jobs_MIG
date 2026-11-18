import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { AdminSidebar, type AdminNavItem } from "@/components/layout/admin-sidebar";
import { AdminGlobalSearch } from "@/components/admin/admin-global-search";
import { Avatar } from "@/components/shared/avatar";
import { siteConfig } from "@/config/site";
import { requireStaff } from "@/modules/access-control/context";
import { PERMISSIONS as P, type Permission } from "@/modules/access-control/permissions";
import { logoutAction } from "@/modules/auth/actions";

const NAV: (AdminNavItem & { permission?: Permission })[] = [
  { href: "/admin/jobs", label: "Jobs", icon: "jobs", section: "Recruitment" },
  { href: "/admin/case-files", label: "Case files", icon: "caseFiles", section: "Recruitment", permission: P.CASE_FILE_VIEW },
  { href: "/admin/applications", label: "Applications", icon: "applications", section: "Recruitment", permission: P.APPLICATION_VIEW },
  { href: "/admin/clients", label: "Clients", icon: "clients", section: "Administration", permission: P.CLIENT_VIEW },
  { href: "/admin/users", label: "Users", icon: "users", section: "Administration", permission: P.USER_MANAGE },
  { href: "/admin/roles", label: "Roles", icon: "roles", section: "Administration", permission: P.ROLE_MANAGE },
];

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const items: AdminNavItem[] = NAV.filter((item) => !item.permission || ctx.can(item.permission)).map(({ href, label, icon, section }) => ({ href, label, icon, section }));
  const name = `${ctx.user.firstName} ${ctx.user.lastName}`;

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b bg-background lg:border-b-0 lg:border-r">
        <div className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
          <div className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5">
            <Link href="/admin/jobs" className="flex items-center gap-2.5">
              <Image src={siteConfig.logo.src} alt={siteConfig.name} width={90} height={40} priority />
            </Link>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</span>
          </div>
          <div className="lg:flex-1 lg:overflow-y-auto">
            <AdminSidebar items={items} />
          </div>
          <div className="hidden border-t p-3 lg:block">
            <div className="flex items-center gap-1">
              <Link href="/admin/profile" title="Profile settings" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60">
                <Avatar name={name} size="sm" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{ctx.roleNames.join(", ") || "No role"}</span>
                </span>
              </Link>
              <form action={logoutAction.bind(null, "staff")}>
                <button type="submit" title="Sign out" aria-label="Sign out" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <AdminGlobalSearch />
          <div className="ml-auto flex items-center gap-3 lg:hidden">
            <Link href="/admin/profile" title="Profile settings" aria-label={`Profile settings for ${name}`} className="rounded-full">
              <Avatar name={name} size="sm" />
            </Link>
            <form action={logoutAction.bind(null, "staff")}>
              <button type="submit" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                <LogOut className="size-3.5" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="outline-none mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
