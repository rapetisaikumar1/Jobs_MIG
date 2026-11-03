"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, Loader2, Search } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";

type Result = { candidates: { displayId: string; name: string; detail: string }[]; jobs: { displayId: string; title: string; detail: string }[] };
type Item = { href: string; key: string };

const DELAY_MS = 200;

/** Admin top-bar search: live candidate and job suggestions while typing; Enter opens Advanced search. */
export function AdminGlobalSearch({ canSearchCandidates }: { canSearchCandidates: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [data, setData] = React.useState<Result | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const term = q.trim();
    if (!term) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/suggest?${new URLSearchParams({ q: term })}`, { signal: controller.signal });
        if (res.ok) {
          setData(await res.json());
          setActive(-1);
        }
      } catch {
        // Superseded by a newer keystroke.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items: Item[] = [
    ...(data?.candidates ?? []).map((c) => ({ key: c.displayId, href: `/admin/candidates/${c.displayId}` })),
    ...(data?.jobs ?? []).map((j) => ({ key: j.displayId, href: `/admin/jobs/${j.displayId}` })),
  ];
  const fullSearch = `/admin/search?${new URLSearchParams({ q: q.trim() })}`;
  const showPanel = open && q.trim() !== "" && data !== null;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      setOpen(false);
      router.push(items[active].href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const row = (i: number) => `flex items-center gap-3 px-3 py-2 ${i === active ? "bg-muted" : "hover:bg-muted"}`;
  let index = -1;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <form action={canSearchCandidates ? "/admin/search" : "/admin/jobs"} onSubmit={() => setOpen(false)}>
        {loading ? (
          <Loader2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        )}
        <input
          name="q"
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(-1); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={canSearchCandidates ? "Search candidates and jobs…" : "Search jobs…"}
          aria-label="Search candidates"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="admin-search-results"
          autoComplete="off"
          className="h-9 w-full rounded-lg border border-transparent bg-muted pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-input focus:bg-background focus:ring-2 focus:ring-ring/10"
        />
      </form>

      {showPanel && (
        <div id="admin-search-results" role="listbox" className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border bg-background shadow-lg">
          {items.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No matches for “{q.trim()}”.</p>}
          {data!.candidates.length > 0 && (
            <div className="py-1">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Candidates</p>
              {data!.candidates.map((c) => {
                const i = ++index;
                return (
                  <Link key={c.displayId} href={`/admin/candidates/${c.displayId}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => setOpen(false)} className={row(i)}>
                    <Avatar name={c.name} size="xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.displayId}{c.detail ? ` · ${c.detail}` : ""}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {data!.jobs.length > 0 && (
            <div className="border-t py-1">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Jobs</p>
              {data!.jobs.map((j) => {
                const i = ++index;
                return (
                  <Link key={j.displayId} href={`/admin/jobs/${j.displayId}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => setOpen(false)} className={row(i)}>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-surface"><Briefcase className="size-3.5" aria-hidden /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{j.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{j.detail}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {canSearchCandidates && (
            <Link href={fullSearch} onClick={() => setOpen(false)} className="flex items-center justify-between border-t px-3 py-2.5 text-sm font-medium hover:bg-muted">
              Search all candidates for “{q.trim()}”
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
