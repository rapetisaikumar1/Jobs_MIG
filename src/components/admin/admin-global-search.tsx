"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, Search } from "lucide-react";

type Result = { jobs: { displayId: string; title: string; detail: string }[] };

const DELAY_MS = 200;

/** Admin top-bar search: live job suggestions while typing; Enter opens the filtered jobs list. */
export function AdminGlobalSearch() {
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

  const items = (data?.jobs ?? []).map((j) => ({ href: `/admin/jobs/${j.displayId}` }));
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

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <form action="/admin/jobs" onSubmit={() => setOpen(false)}>
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
          placeholder="Search jobs…"
          aria-label="Search jobs"
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
          {data!.jobs.length > 0 && (
            <div className="py-1">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Jobs</p>
              {data!.jobs.map((j, i) => (
                <Link key={j.displayId} href={`/admin/jobs/${j.displayId}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => setOpen(false)} className={row(i)}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-surface"><Briefcase className="size-3.5" aria-hidden /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{j.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{j.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
