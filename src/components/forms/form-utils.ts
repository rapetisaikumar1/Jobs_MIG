"use client";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/lib/action-result";

/** Copies server-side validation errors onto React Hook Form fields. */
export function applyServerErrors<T extends FieldValues>(result: ActionResult<unknown>, setError: UseFormSetError<T>) {
  if (result.ok || !result.fieldErrors) return;
  for (const [key, messages] of Object.entries(result.fieldErrors)) {
    const field = key.split(".")[0] as Path<T>;
    setError(field, { type: "server", message: messages[0] });
  }
}

/** Reads a nested RHF error message without fighting its deep types. */
export function errorMessage(errors: Record<string, unknown>, name: string): string | undefined {
  const entry = errors[name] as ({ message?: unknown; root?: { message?: unknown } } & Record<string, unknown>) | undefined;
  if (!entry) return undefined;
  if (typeof entry.message === "string") return entry.message;
  if (typeof entry.root?.message === "string") return entry.root.message;
  // List fields (tag inputs) report errors per entry, e.g. errors.primarySkills[2].message.
  for (const item of Object.values(entry)) {
    const message = (item as { message?: unknown } | undefined)?.message;
    if (typeof message === "string") return message;
  }
  return undefined;
}
