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

/** Portal heading: a greeting on the dashboard, the section name elsewhere. */
export function CandidateHeading({ firstName }: { firstName: string }) {
  const pathname = usePathname();
  const section = LINKS.find((l) => l.href !== "/candidate/dashboard" && pathname.startsWith(l.href));
  const title = section ? (section.href === "/candidate/profile" ? "My profile" : section.label) : `Welcome back, ${firstName}`;
  return <h1 className="text-xl font-semibold tracking-tight">{title}</h1>;
}
