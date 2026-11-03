"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/candidate/dashboard", label: "Dashboard" },
  { href: "/candidate/applications", label: "My applications" },
  { href: "/candidate/profile", label: "Profile & documents" },
];

export function CandidateNav() {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Candidate">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "whitespace-nowrap border-b-2 py-3 text-sm font-medium",
            pathname.startsWith(link.href) ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
