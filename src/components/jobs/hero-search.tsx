"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, Loader2, MapPin, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

type Suggestion = { displayId: string; title: string; location: string; meta: string };

const DELAY_MS = 200;

/** Homepage search with live job suggestions while typing. Submitting opens the full results. */
export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [results, setResults] = React.useState<{ total: number; jobs: Suggestion[] } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!q.trim() && !location.trim()) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: q.trim(), location: location.trim(), country });
        const res = await fetch(`/api/jobs/suggest?${params}`, { signal: controller.signal });
        if (res.ok) {
          setResults(await res.json());
          setActive(-1);
        }
      } catch {
        // Aborted by a newer keystroke.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, location, country]);

  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const allHref = `/jobs?${new URLSearchParams({ q: q.trim(), location: location.trim(), country })}`;
  const showPanel = open && (q.trim() || location.trim()) && results !== null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (!results?.jobs.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.jobs.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      router.push(`/jobs/${results.jobs[active].displayId}`);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const input = "h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/80";
  return (
    <div ref={boxRef} className="relative mt-8">
      <form action="/jobs" method="get" className="flex flex-col gap-2 rounded-xl border bg-background p-2 shadow-md sm:flex-row sm:items-center sm:gap-0">
        <label className="flex flex-1 items-center gap-2 px-3">
          {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          <input
            name="q"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(-1); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Job title or skill"
            aria-label="Job title or skill"
            autoComplete="off"
            role="combobox"
            aria-expanded={!!showPanel}
            aria-controls="hero-suggestions"
            className={input}
          />
        </label>
        <span className="hidden h-7 w-px bg-border sm:block" aria-hidden />
        <label className="flex flex-1 items-center gap-2 px-3">
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            name="location"
            value={location}
            onChange={(e) => { setLocation(e.target.value); setActive(-1); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="City or province"
            aria-label="Location"
            autoComplete="off"
            className={input}
          />
        </label>
        <span className="hidden h-7 w-px bg-border sm:block" aria-hidden />
        <select name="country" aria-label="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-11 bg-transparent px-3 text-[15px] outline-none">
          <option value="">US &amp; Canada</option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
        </select>
        <button type="submit" className={buttonVariants({ size: "lg", className: "sm:ml-1" })}>
          Search
        </button>
      </form>

      {showPanel && (
        <div id="hero-suggestions" role="listbox" className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border bg-background shadow-lg">
          {results.jobs.length ? (
            <>
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.jobs.map((job, i) => (
                  <li key={job.displayId} role="option" aria-selected={i === active}>
                    <Link
                      href={`/jobs/${job.displayId}`}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-center gap-3 px-4 py-2.5 ${i === active ? "bg-muted" : "hover:bg-muted"}`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-surface"><Briefcase className="size-4" aria-hidden /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{job.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{job.location} · {job.meta}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={allHref} className="flex items-center justify-between border-t px-4 py-2.5 text-sm font-medium hover:bg-muted">
                View all {results.total} {results.total === 1 ? "result" : "results"}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">No open jobs match “{q.trim() || location.trim()}”. Try another title, skill or city.</p>
          )}
        </div>
      )}
    </div>
  );
}
