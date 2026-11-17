import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/format";

const NOW = new Date("2026-11-17T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it.each([
    [0, "just now"],
    [30 * SECOND, "just now"],
    [50 * SECOND, "1 minute ago"],
    [5 * MINUTE, "5 minutes ago"],
    [59 * MINUTE, "59 minutes ago"],
    [HOUR, "1 hour ago"],
    [23 * HOUR, "23 hours ago"],
    [DAY, "1 day ago"],
    [6 * DAY, "6 days ago"],
    [7 * DAY, "1 week ago"],
    [15 * DAY, "2 weeks ago"],
    [29 * DAY, "4 weeks ago"],
    [30 * DAY, "1 month ago"],
    [200 * DAY, "6 months ago"],
    [360 * DAY, "1 year ago"],
    [800 * DAY, "2 years ago"],
  ])("formats %i ms ago as %s", (ms, expected) => expect(formatRelativeTime(ago(ms), NOW)).toBe(expected));

  it("formats future dates", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 3 * DAY), NOW)).toBe("in 3 days");
    expect(formatRelativeTime(new Date(NOW.getTime() + 10 * SECOND), NOW)).toBe("just now");
  });

  it("accepts ISO strings", () => expect(formatRelativeTime("2026-11-17T09:00:00.000Z", NOW)).toBe("3 hours ago"));

  it.each([null, undefined, "not a date"])("returns a dash for %s", (value) => expect(formatRelativeTime(value, NOW)).toBe("—"));
});
