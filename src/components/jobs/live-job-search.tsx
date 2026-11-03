"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DELAY_MS = 250;

/**
 * "What / where" search bar that updates the results while the user types.
 * It rewrites the URL (?q=&location=, keeping other filters) after a short pause,
 * so the server re-renders the list. Pressing Enter / Search still submits the form.
 */
export function LiveJobSearch({ q, location }: { q?: string; location?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [values, setValues] = React.useState({ q: q ?? "", location: location ?? "" });
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  // Keep the inputs in sync when the URL changes elsewhere (e.g. "Clear all", back button).
  React.useEffect(() => {
    setValues((v) => ({
      q: (q ?? "") === v.q.trim() ? v.q : (q ?? ""),
      location: (location ?? "") === v.location.trim() ? v.location : (location ?? ""),
    }));
  }, [q, location]);

  function update(field: "q" | "location", value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of ["q", "location"] as const) {
        const v = next[key].trim();
        if (v) params.set(key, v);
        else params.delete(key);
      }
      params.delete("page");
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, DELAY_MS);
  }

  const field = "h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/80";
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-2 shadow-sm sm:flex-row sm:items-center sm:gap-0">
      <label className="flex flex-1 items-center gap-2 px-3">
        {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <input
          name="q"
          value={values.q}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Job title, skill or keyword"
          aria-label="Job title or skill"
          autoComplete="off"
          className={field}
        />
        {values.q && (
          <button type="button" onClick={() => update("q", "")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </label>
      <span className="hidden h-7 w-px bg-border sm:block" aria-hidden />
      <label className="flex flex-1 items-center gap-2 px-3">
        <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          name="location"
          value={values.location}
          onChange={(e) => update("location", e.target.value)}
          placeholder="City, state or province"
          aria-label="Location"
          autoComplete="off"
          className={field}
        />
      </label>
      <Button type="submit" className="h-10 px-6">Search jobs</Button>
      <span className="sr-only" aria-live="polite">{pending ? "Updating results" : ""}</span>
    </div>
  );
}
