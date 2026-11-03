"use client";

import * as React from "react";
import { X } from "lucide-react";
import { inputClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Multi-value text input (skills, certifications, preferred titles...).
 * Enter or comma adds a value; suggestions come from a <datalist>.
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder = "Type and press Enter",
  suggestions,
  max = 30,
  invalid,
}: {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
  invalid?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  const listId = suggestions?.length ? `${id}-suggestions` : undefined;

  function add(raw: string) {
    const parts = raw.split(",").map((p) => p.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const part of parts) {
      if (next.length >= max) break;
      if (!next.some((v) => v.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div
      className={cn(inputClass, "flex h-auto min-h-9 flex-wrap items-center gap-1.5 py-1.5", invalid && "border-destructive")}
      onClick={() => document.getElementById(id)?.focus()}
    >
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
          {tag}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onChange(value.filter((v) => v !== tag))}
            aria-label={`Remove ${tag}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={listId}
        value={draft}
        placeholder={value.length ? "" : placeholder}
        aria-invalid={invalid || undefined}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
