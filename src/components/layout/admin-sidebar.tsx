"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  ClipboardList,
  FileSearch,
  FolderOpen,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkPending } from "@/components/layout/link-pending";

const ICONS = {
  jobs: Briefcase,
  applications: ClipboardList,
  caseFiles: FolderOpen,
  candidates: Users,
  search: FileSearch,
  users: UserCog,
  roles: ShieldCheck,
};

export type AdminNavItem = { href: string; label: string; icon: keyof typeof ICONS; section?: string };

export function AdminSidebar({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  let lastSection: string | undefined;
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 py-2 lg:flex-col lg:overflow-visible lg:py-4" aria-label="Admin">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const heading = item.section && item.section !== lastSection ? item.section : null;
        const isFirstHeading = lastSection === undefined;
        lastSection = item.section;
        return (
          <div key={item.href} className="contents">
            {heading && (
              <p className={cn("hidden px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 lg:block", isFirstHeading ? "mt-1" : "mt-6")}>
                {heading}
              </p>
            )}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-semibold text-foreground lg:before:absolute lg:before:inset-y-1.5 lg:before:-left-3 lg:before:w-[3px] lg:before:rounded-r-full lg:before:bg-brand"
                  : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active && "text-foreground")} aria-hidden />
              {item.label}
              <LinkPending className="ml-auto" />
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
