"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPING_DELAY_MS = 300;

/**
 * GET search/filter form whose results update while the user types.
 * Text inputs re-run the search after a short pause; selects, checkboxes, radios and
 * dates apply immediately. The URL is updated (shareable, back button works) and the
 * server re-renders the results. Enter / the submit button still work as before.
 */
export function LiveSearchForm({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  // Every query string this form has written. URL updates can land late and out of order while
  // the user keeps typing; one of ours arriving must never reset the fields (that dropped
  // characters). Only a URL change from elsewhere ("Clear" link, back button) resets them.
  const pushed = React.useRef<Set<string>>(new Set([searchParams.toString()]));
  const typing = React.useRef(false);
  const [resetKey, setResetKey] = React.useState(0);
  const current = searchParams.toString();

  React.useEffect(() => {
    if (pushed.current.has(current) || typing.current) return;
    pushed.current = new Set([current]);
    setResetKey((k) => k + 1);
  }, [current]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  function run(form: HTMLFormElement, delay: number) {
    clearTimeout(timer.current);
    typing.current = delay > 0;
    timer.current = setTimeout(() => {
      typing.current = false;
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form)) {
        if (typeof value === "string" && value.trim() !== "") params.append(key, value.trim());
      }
      const qs = params.toString();
      if (qs === current) return;
      if (pushed.current.size > 50) pushed.current = new Set([current]);
      pushed.current.add(qs);
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, delay);
  }

  function onEvent(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    const typing = target.tagName === "INPUT" && ["text", "search", "email", "tel", "number", ""].includes(target.type) || target.tagName === "TEXTAREA";
    if (e.type === "input" && !typing) return; // selects/checkboxes/dates are handled on "change"
    if (e.type === "change" && typing) return;
    run(e.currentTarget, typing ? TYPING_DELAY_MS : 0);
  }

  return (
    <form method="get" action={pathname} className={cn("relative", className)} onInput={onEvent} onChange={onEvent} key={resetKey}>
      {children}
      {pending && (
        <span className="pointer-events-none absolute right-3 top-3 text-muted-foreground" aria-hidden>
          <Loader2 className="size-4 animate-spin" />
        </span>
      )}
      <span className="sr-only" aria-live="polite">{pending ? "Updating results" : ""}</span>
    </form>
  );
}
