import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchParams } from "@/lib/pagination";

function hrefFor(basePath: string, params: SearchParams, page: number) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) if (v) usp.append(key, v);
  }
  if (page > 1) usp.set("page", String(page));
  const qs = usp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Sends an out-of-range ?page= (e.g. page 99 of 2) to the last page that has results. */
export function redirectPastLastPage(basePath: string, params: SearchParams, page: number, pageSize: number, total: number) {
  const pages = Math.ceil(total / pageSize);
  if (total > 0 && page > pages) redirect(hrefFor(basePath, params, pages));
}

export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: SearchParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label="Pagination">
      <p className="text-muted-foreground">
        Showing {from}–{to} of {total.toLocaleString("en-US")}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={page <= 1}
            href={hrefFor(basePath, params, page - 1)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
          >
            <ChevronLeft aria-hidden /> Previous
          </Link>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Link
            aria-disabled={page >= pages}
            href={hrefFor(basePath, params, page + 1)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}
          >
            Next <ChevronRight aria-hidden />
          </Link>
        </div>
      )}
    </nav>
  );
}
