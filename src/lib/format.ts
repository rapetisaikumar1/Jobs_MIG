// Pure formatting/parsing helpers shared by server and client code.

import type { CompensationType, Currency } from "@prisma/client";

export const DEFAULT_TIME_ZONE = "America/Toronto";
/**
 * Application deadlines are inclusive calendar dates. A job stays open through the
 * end of its deadline date in Pacific Time, so it is still open everywhere in the
 * continental US and Canada for the whole day.
 */
export const DEADLINE_TIME_ZONE = "America/Los_Angeles";

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "Oct 30, 2026" in the viewer's time zone (for timestamps). */
export function formatDate(date: Date | string | null | undefined, timeZone = DEFAULT_TIME_ZONE): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(new Date(date));
}

/** "October 30, 2026" in the viewer's time zone (for timestamps). */
export function formatLongDate(date: Date | string | null | undefined, timeZone = DEFAULT_TIME_ZONE): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone }).format(new Date(date));
}

/** "Oct 30, 2026, 3:15 PM EDT" in the viewer's time zone. */
export function formatDateTime(date: Date | string | null | undefined, timeZone = DEFAULT_TIME_ZONE): string {
  if (!date) return "—";
  // dateStyle/timeStyle cannot be combined with timeZoneName, so spell out the parts.
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(date));
}

/** Format a calendar date stored as a Postgres DATE (no time zone shifting). */
export function formatCalendarDate(date: Date | string | null | undefined, style: "medium" | "long" = "long"): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: style, timeZone: "UTC" }).format(new Date(date));
}

/** "YYYY-MM-DD" for a Postgres DATE value (for <input type="date">). */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

/** Parse "YYYY-MM-DD" into a UTC-midnight Date suitable for a Postgres DATE column. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Current calendar date ("YYYY-MM-DD") in the given time zone. */
export function calendarDateIn(timeZone: string, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isDeadlinePassed(deadline: Date | string | null | undefined, now = new Date()): boolean {
  if (!deadline) return false;
  return toDateInputValue(deadline) < calendarDateIn(DEADLINE_TIME_ZONE, now);
}

/** Earliest deadline date that is still open today, as a UTC-midnight Date (for DB filters). */
export function openDeadlineCutoff(now = new Date()): Date {
  return parseDateInput(calendarDateIn(DEADLINE_TIME_ZONE, now))!;
}

type DecimalLike = { toNumber(): number };

export function decimalToNumber(value: DecimalLike | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

export function formatMoney(amount: number, currency: Currency): string {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
  // Format with "$" and append the ISO code so USD and CAD are never ambiguous.
  return `${formatted} ${currency}`;
}

/** "$110,000–$130,000 CAD / year", "$85–$95 USD / hour", "From $90,000 USD / year". */
export function formatCompensation(
  min: number | null,
  max: number | null,
  currency: Currency,
  type: CompensationType,
): string | null {
  const unit = type === "HOURLY" ? " / hour" : " / year";
  const money = (n: number) => formatMoney(n, currency).replace(` ${currency}`, "");
  if (min != null && max != null && min !== max) return `${money(min)}–${money(max)} ${currency}${unit}`;
  if (min != null && max != null) return `${money(min)} ${currency}${unit}`;
  if (min != null) return `From ${money(min)} ${currency}${unit}`;
  if (max != null) return `Up to ${money(max)} ${currency}${unit}`;
  return null;
}

export function formatYears(years: number | null | undefined): string {
  if (years === null || years === undefined) return "—";
  return `${years} ${years === 1 ? "year" : "years"}`;
}

/** "5–8 years", "5+ years", "Up to 3 years". */
export function formatExperienceRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min != null && max != null) return min === max ? formatYears(min) : `${min}–${max} years`;
  if (min != null) return `${min}+ years`;
  if (max != null) return `Up to ${formatYears(max)}`;
  return "Not specified";
}

/**
 * Normalize a phone number to E.164. US and Canada share the North American
 * Numbering Plan (+1, 10 digits). Other countries must be entered with "+".
 * Returns null when the number is not valid.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  const nanp = (d: string) => /^[2-9]\d{2}[2-9]\d{6}$/.test(d);

  if (trimmed.startsWith("+") && !trimmed.startsWith("+1")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10 && nanp(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && nanp(digits.slice(1))) return `+${digits}`;
  return null;
}

/** "+1 (416) 555-0100" for North American numbers; other numbers are returned as stored. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+1 (${match[1]}) ${match[2]}-${match[3]}` : phone;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** Lower-cased, whitespace-collapsed skill slug used for matching ("Spring  Boot" -> "spring boot"). */
export function skillSlug(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Trim and de-duplicate a list of free-text values (case-insensitive). */
export function cleanList(values: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values ?? []) {
    const value = raw.trim().replace(/\s+/g, " ");
    const key = value.toLowerCase();
    if (value && !seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}
