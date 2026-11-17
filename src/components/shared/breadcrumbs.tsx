import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Folder-style path, e.g. Case files › Senior Java Developer › MIG-APP-000001. */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  // Long labels (job titles) are truncated, with the full text on hover.
  const labelClass = "max-w-[14rem] truncate sm:max-w-xs lg:max-w-md";
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
          {item.href ? (
            <Link href={item.href} title={item.label} className={`${labelClass} hover:text-foreground hover:underline`}>{item.label}</Link>
          ) : (
            <span title={item.label} className={`${labelClass} font-medium text-foreground`} aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
