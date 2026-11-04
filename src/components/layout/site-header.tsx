import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Avatar } from "@/components/shared/avatar";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/modules/auth/session";
import { logoutAction } from "@/modules/auth/actions";

async function getViewer() {
  const user = await getAuthUser().catch(() => null);
  if (!user) return null;
  const appUser = await prisma.user.findUnique({ where: { id: user.id }, select: { type: true, firstName: true, lastName: true } });
  return { type: appUser?.type ?? "CANDIDATE", name: appUser ? `${appUser.firstName} ${appUser.lastName}` : (user.email ?? "") };
}

export async function SiteHeader() {
  const viewer = await getViewer();
  const navLinks = [
    { href: "/jobs", label: "Find jobs" },
    ...(viewer?.type === "CANDIDATE" ? [{ href: "/candidate/dashboard", label: "My account" }] : []),
    ...(viewer?.type === "STAFF" ? [{ href: "/admin/jobs", label: "Admin portal" }] : []),
  ];

  const signOut = (
    <form action={logoutAction.bind(null, "candidate")}>
      <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Sign out
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4">
        <Logo height={40} />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {viewer ? (
            <>
              <Link href={viewer.type === "STAFF" ? "/admin/jobs" : "/candidate/profile"} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium hover:bg-muted" title="My profile">
                <Avatar name={viewer.name} size="sm" />
                <span className="max-w-36 truncate">{viewer.name.split(" ")[0]}</span>
              </Link>
              {signOut}
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
              <Link href="/register" className={buttonVariants({ size: "sm" })}>
                Create account
              </Link>
            </>
          )}
        </div>
        <details className="relative ml-auto md:hidden">
          <summary className={buttonVariants({ variant: "outline", size: "icon" }) + " list-none"} aria-label="Open menu">
            <Menu />
          </summary>
          <div className="absolute right-0 mt-2 flex w-60 flex-col gap-1 rounded-xl border bg-background p-2 shadow-lg">
            {viewer && (
              <div className="mb-1 flex items-center gap-2 border-b px-2 pb-3 pt-1">
                <Avatar name={viewer.name} size="sm" />
                <span className="truncate text-sm font-medium">{viewer.name}</span>
              </div>
            )}
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm hover:bg-muted">
                {link.label}
              </Link>
            ))}
            {viewer?.type === "CANDIDATE" && (
              <Link href="/candidate/profile" className="rounded-md px-3 py-2 text-sm hover:bg-muted">Profile &amp; documents</Link>
            )}
            <div className="mt-1 flex flex-col gap-2 border-t pt-2">
              {viewer ? signOut : (
                <>
                  <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>Sign in</Link>
                  <Link href="/register" className={buttonVariants({ size: "sm" })}>Create account</Link>
                </>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
