"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { inputClass } from "@/components/ui/input";
import { regionsFor, type Region } from "@/config/locations";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  country: string | undefined;
  value: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  invalid?: boolean;
  /** Receives the trigger button so React Hook Form can focus the field on a validation error. */
  ref?: React.Ref<HTMLButtonElement>;
};

/**
 * Multi-select for US states / Canadian provinces: a field showing the chosen regions as
 * removable chips, and a dropdown panel with a search box and a checkable list.
 *
 * Keyboard: Enter / Space / ArrowDown on the field opens the panel with the search box focused;
 * ArrowUp / ArrowDown move through the list, Enter toggles the highlighted region, Escape closes.
 */
export function RegionMultiSelect({ id, country, value, onChange, onBlur, invalid, ref }: Props) {
  const regions = regionsFor(country);
  const noun = country === "CA" ? "provinces" : "states";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-listbox`;
  const optionId = (code: string) => `${id}-option-${code}`;

  const setTriggerRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.RefObject<HTMLButtonElement | null>).current = node;
    },
    [ref],
  );

  const selected = new Set(value);
  const q = query.trim().toLowerCase();
  const filtered = q ? regions.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase() === q) : regions;
  const activeRegion: Region | undefined = filtered[Math.min(active, filtered.length - 1)];
  const activeCode = activeRegion?.code;

  const close = React.useCallback((focusTrigger: boolean) => {
    setOpen(false);
    setQuery("");
    setActive(0);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  // Close on a click / tap outside the component.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  React.useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Keep the highlighted option visible while moving with the arrow keys.
  React.useEffect(() => {
    if (!open || !activeCode) return;
    document.getElementById(`${id}-option-${activeCode}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeCode, id]);

  // Selection order follows the list order (stable, readable chips), not click order.
  function emit(next: Set<string>) {
    onChange(regions.filter((r) => next.has(r.code)).map((r) => r.code));
  }

  function toggle(code: string) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    emit(next);
  }

  function selectAllShown() {
    emit(new Set([...selected, ...filtered.map((r) => r.code)]));
  }

  function clearAll() {
    onChange([]);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (filtered.length ? (Math.min(i, filtered.length - 1) + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (filtered.length ? (Math.min(i, filtered.length - 1) - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === "Home" && event.ctrlKey) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && event.ctrlKey) {
      event.preventDefault();
      setActive(Math.max(filtered.length - 1, 0));
    } else if (event.key === "Enter") {
      // Never submit the surrounding form from inside the picker.
      event.preventDefault();
      if (activeRegion) toggle(activeRegion.code);
    }
  }

  function onRootKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  }

  function onRootBlur(event: React.FocusEvent<HTMLDivElement>) {
    // Focus left the whole component (Tab, or a click elsewhere): close and mark as touched.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (open) close(false);
    onBlur?.();
  }

  const summary = value.length
    ? `${value.length} ${value.length === 1 ? noun.slice(0, -1) : noun} selected`
    : `Select ${noun}`;

  return (
    <div ref={rootRef} className="relative" onBlur={onRootBlur} onKeyDown={onRootKeyDown}>
      <div
        className={cn(
          inputClass,
          "h-auto min-h-9 cursor-pointer flex-wrap items-center gap-1.5 py-1.5 pr-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
          open && "border-ring ring-2 ring-ring/20",
          !regions.length && "cursor-not-allowed opacity-50",
          invalid && "border-destructive",
        )}
        // While open, keep focus in the search box (otherwise its blur would close the panel
        // before this click toggles it).
        onMouseDown={(event) => { if (open) event.preventDefault(); }}
        onClick={(event) => {
          // Clicks on a chip's remove button are handled by that button.
          if (!regions.length || (event.target as HTMLElement).closest("[data-chip-remove]")) return;
          if (open) close(true);
          else setOpen(true);
        }}
      >
        {regions
          .filter((r) => selected.has(r.code))
          .map((r) => (
            <span key={r.code} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
              {r.name}
              <button
                type="button"
                data-chip-remove
                className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                onClick={() => {
                  toggle(r.code);
                  // The chip disappears: move focus somewhere stable inside the field.
                  if (!open) triggerRef.current?.focus();
                }}
                aria-label={`Remove ${r.name}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        <button
          ref={setTriggerRef}
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          disabled={!regions.length}
          className="flex min-w-[8rem] flex-1 items-center justify-between gap-2 bg-transparent text-left text-sm outline-none disabled:cursor-not-allowed"
          onClick={(event) => {
            // Handled here; don't let the wrapper's click handler toggle it a second time.
            event.stopPropagation();
            if (open) close(true);
            else setOpen(true);
          }}
          onKeyDown={(event) => {
            if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {value.length ? (
            <span className="truncate text-muted-foreground">
              <span className="sr-only">{summary}. </span>
              <span aria-hidden>{`Add or remove ${noun}`}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground/70">{regions.length ? summary : "Select a country first"}</span>
          )}
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>

      {open && (
        <div
          className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
          // Clicks inside the panel keep focus in the search box (Safari does not focus clicked
          // buttons, so the search box would blur and close the panel before the click lands).
          onMouseDown={(event) => { if (event.target !== searchRef.current) event.preventDefault(); }}
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label={`Search ${noun}`}
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeRegion ? optionId(activeRegion.code) : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={`Search ${noun}`}
              autoComplete="off"
              className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); setActive(0); searchRef.current?.focus(); }} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable
            aria-label={country === "CA" ? "Provinces" : "States"}
            className="max-h-64 overflow-y-auto p-1"
          >
            {filtered.map((r, i) => {
              const isSelected = selected.has(r.code);
              const isActive = activeRegion?.code === r.code;
              return (
                <li
                  key={r.code}
                  id={optionId(r.code)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => toggle(r.code)}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                    isActive && "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
                    )}
                    aria-hidden
                  >
                    {isSelected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="flex-1">{r.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                </li>
              );
            })}
            {!filtered.length && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No {noun} match “{query.trim()}”.</li>}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
            <span className="text-muted-foreground" aria-live="polite">{summary}</span>
            <span className="flex items-center gap-3">
              {filtered.length > 0 && (
                <button type="button" onClick={selectAllShown} className="font-medium hover:underline">
                  {q ? "Select shown" : "Select all"}
                </button>
              )}
              {value.length > 0 && (
                <button type="button" onClick={clearAll} className="font-medium hover:underline">Clear</button>
              )}
              <button type="button" onClick={() => close(true)} className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground hover:bg-primary/90">
                Done
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
