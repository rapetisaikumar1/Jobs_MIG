// Zod building blocks shared by client forms (React Hook Form) and server actions.
// Everything submitted is re-validated on the server with the same schema.

import { z } from "zod";
import { cleanList, normalizePhone, parseDateInput } from "@/lib/format";

/** Turn "", whitespace-only strings and null into undefined (form inputs submit ""). */
export function blankToUndefined(value: unknown): unknown {
  if (value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return value;
}

export function enumValues<T extends string>(labels: Record<T, string>): [T, ...T[]] {
  return Object.keys(labels) as [T, ...T[]];
}

export const requiredText = (label: string, max = 200) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const optionalText = (max = 200) =>
  z.preprocess(blankToUndefined, z.string().max(max, `Must be ${max} characters or fewer`).optional());

export const optionalNumber = (min: number, max: number, opts: { integer?: boolean } = {}) =>
  z.preprocess(
    (v) => {
      const b = blankToUndefined(v);
      return b === undefined ? undefined : Number(b);
    },
    (opts.integer ? z.number({ error: "Enter a whole number" }).int("Enter a whole number") : z.number({ error: "Enter a number" }))
      .min(min, `Must be at least ${min}`)
      .max(max, `Must be at most ${max}`)
      .optional(),
  );

export const optionalEnum = <T extends string>(values: [T, ...T[]]) =>
  z.preprocess(blankToUndefined, z.enum(values).optional());

export const stringList = (maxItems = 30, maxLength = 100) =>
  z
    .array(z.string().trim().max(maxLength, `Each entry must be ${maxLength} characters or fewer`))
    .max(maxItems, `Add at most ${maxItems} entries`)
    .transform((values) => cleanList(values));

export const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

export const optionalEmail = z.preprocess(blankToUndefined, email.optional());

const PHONE_MESSAGE = "Enter a valid phone number, e.g. (416) 555-0100 or +44 20 7946 0958";

export const phone = z
  .string({ error: "Phone number is required" })
  .trim()
  .min(1, "Phone number is required")
  .max(30)
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: PHONE_MESSAGE });
      return z.NEVER;
    }
    return normalized;
  });

export const optionalPhone = z.preprocess(blankToUndefined, phone.optional());

/**
 * "YYYY-MM-DD" from <input type="date">, converted to a UTC-midnight Date.
 * Also accepts a Date, because React Hook Form submits already-parsed values and
 * the server action validates them again with the same schema.
 */
export const optionalDate = z.preprocess(
  (v) => (v instanceof Date ? (Number.isNaN(v.getTime()) ? v : v.toISOString().slice(0, 10)) : blankToUndefined(v)),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .transform((value, ctx) => {
      const date = parseDateInput(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date" });
        return z.NEVER;
      }
      return date;
    })
    .optional(),
);

export const optionalUrl = z.preprocess(
  blankToUndefined,
  z
    .url({ protocol: /^https?$/, error: "Enter a valid URL starting with https://" })
    .max(300)
    .optional(),
);

export const uuid = z.uuid("Invalid identifier");
export const optionalUuid = z.preprocess(blankToUndefined, uuid.optional());

export const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

/** Checkbox values arrive as booleans from RHF and as "on"/"true" from plain forms. */
export const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
