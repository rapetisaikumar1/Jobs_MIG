import { describe, expect, it } from "vitest";
import {
  cleanList,
  formatCompensation,
  formatDate,
  formatDateTime,
  formatExperienceRange,
  formatPhone,
  isDeadlinePassed,
  normalizePhone,
  parseDateInput,
  skillSlug,
} from "@/lib/format";

describe("phone numbers (US/Canada NANP)", () => {
  it.each([
    ["(416) 555-0100", "+14165550100"],
    ["416.555.0100", "+14165550100"],
    ["1-212-555-0199", "+12125550199"],
    ["+1 604 555 0123", "+16045550123"],
  ])("normalizes %s", (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it("accepts international numbers entered with +", () => expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958"));
  it.each(["555-0100", "(116) 555-0100", "abc", ""])("rejects %s", (input) => expect(normalizePhone(input)).toBeNull());
  it("formats for display", () => expect(formatPhone("+14165550100")).toBe("+1 (416) 555-0100"));
});

describe("compensation", () => {
  it("formats annual CAD ranges", () =>
    expect(formatCompensation(110000, 130000, "CAD", "ANNUAL")).toBe("$110,000–$130,000 CAD / year"));
  it("formats hourly USD rates", () => expect(formatCompensation(75, 90, "USD", "HOURLY")).toBe("$75–$90 USD / hour"));
  it("handles open-ended values", () => {
    expect(formatCompensation(90000, null, "USD", "ANNUAL")).toBe("From $90,000 USD / year");
    expect(formatCompensation(null, null, "USD", "ANNUAL")).toBeNull();
  });
});

describe("experience", () => {
  it("formats ranges", () => {
    expect(formatExperienceRange(5, 8)).toBe("5–8 years");
    expect(formatExperienceRange(5, null)).toBe("5+ years");
    expect(formatExperienceRange(null, null)).toBe("Not specified");
  });
});

describe("application deadline", () => {
  const deadline = parseDateInput("2026-11-30")!;
  it("is open through the deadline date in Pacific Time", () => {
    // 2026-12-01 07:00 UTC is still Nov 30 in Los Angeles.
    expect(isDeadlinePassed(deadline, new Date("2026-12-01T07:00:00Z"))).toBe(false);
  });
  it("is closed the day after", () => {
    expect(isDeadlinePassed(deadline, new Date("2026-12-01T09:00:00Z"))).toBe(true);
  });
  it("no deadline never passes", () => expect(isDeadlinePassed(null)).toBe(false));
});

describe("lists and skills", () => {
  it("de-duplicates case-insensitively and trims", () =>
    expect(cleanList([" Java ", "java", "Spring  Boot", ""])).toEqual(["Java", "Spring Boot"]));
  it("normalizes skill slugs", () => expect(skillSlug("  Spring   BOOT ")).toBe("spring boot"));
});

describe("dates (stored in UTC, shown in the viewer's time zone)", () => {
  const instant = new Date("2026-11-01T03:30:00Z");
  it("formats timestamps with the time zone", () => {
    expect(formatDateTime(instant, "America/Toronto")).toBe("Oct 31, 2026, 11:30 PM EDT");
    expect(formatDateTime(instant, "America/Vancouver")).toBe("Oct 31, 2026, 8:30 PM PDT");
  });
  it("formats dates in the viewer's zone", () => {
    expect(formatDate(instant, "America/New_York")).toBe("Oct 31, 2026");
    expect(formatDate(instant, "UTC")).toBe("Nov 1, 2026");
  });
});
