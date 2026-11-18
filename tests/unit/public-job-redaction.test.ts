import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatJobLocation, formatJobPlace, jobStates, matchRegions, parseLocationQuery } from "@/config/locations";
import { invalidateCache } from "@/lib/ttl-cache";
import {
  getPublicJob,
  listHomepageJobs,
  listPublicJobs,
  PUBLIC_JOBS_CACHE,
  publicJobSelect,
  redactHiddenSalary,
  suggestPublicJobs,
} from "@/modules/jobs/queries";

// Record what the public queries ask the database for, without a database.
const calls = vi.hoisted(() => ({ selects: [] as unknown[] }));
vi.mock("@/lib/prisma", () => {
  const record = (result: unknown) => async (args: { select?: unknown }) => {
    calls.selects.push(args.select);
    return result;
  };
  return { prisma: { job: { findMany: record([]), findFirst: record(null), count: async () => 0 } } };
});

/** Every key at any depth of a Prisma select object. */
function selectKeys(select: unknown): string[] {
  if (!select || typeof select !== "object") return [];
  return Object.entries(select).flatMap(([key, value]) => [key, ...selectKeys(value)]);
}

describe("public job selects", () => {
  beforeEach(() => {
    calls.selects = [];
    invalidateCache(PUBLIC_JOBS_CACHE);
  });

  it("publicJobSelect (and the card select derived from it) has no client fields", () => {
    expect(selectKeys(publicJobSelect)).not.toContain("client");
    expect(selectKeys(publicJobSelect)).not.toContain("clientId");
  });

  it("contain no client details in any job portal query", async () => {
    await Promise.all([
      listPublicJobs({ q: "redaction-test" }, 1),
      listHomepageJobs(),
      suggestPublicJobs({ q: "redaction-test" }),
      getPublicJob("JOB-REDACTION-TEST"),
    ]);
    expect(calls.selects).toHaveLength(4);
    for (const select of calls.selects) {
      expect(select).toBeTruthy(); // an explicit select, never the whole row
      const keys = selectKeys(select);
      expect(keys).not.toContain("client");
      expect(keys).not.toContain("clientId");
      expect(keys).toContain("workArrangement");
    }
  });
});

describe("redactHiddenSalary", () => {
  it("strips compensation from jobs whose salary is not public", () => {
    const job = { id: "j", salaryPublic: false, compensationMin: 90000, compensationMax: 110000 } as never;
    expect(redactHiddenSalary(job)).toMatchObject({ id: "j", compensationMin: null, compensationMax: null });
  });
  it("keeps compensation when the salary is public", () => {
    const job = { salaryPublic: true, compensationMin: 1, compensationMax: 2 } as never;
    expect(redactHiddenSalary(job)).toBe(job);
  });
});

describe("job locations", () => {
  it("formats one state like other locations and several states compactly", () => {
    expect(formatJobLocation("Seattle", ["WA"], "US")).toBe("Seattle, Washington, United States");
    expect(formatJobLocation("Seattle", ["WA", "OR", "CA"], "US")).toBe("Seattle · WA, OR, CA · United States");
    expect(formatJobLocation("Austin", ["TX", "WA", "OR", "CA"], "US")).toBe("Austin · 4 states · United States");
    expect(formatJobLocation("Toronto", ["ON", "BC", "AB", "QC", "NS"], "CA")).toBe("Toronto · 5 provinces · Canada");
    expect(jobStates({ state: "ON", states: [] })).toEqual(["ON"]);
    expect(jobStates({ state: "ON", states: ["ON", "BC"] })).toEqual(["ON", "BC"]);
  });

  it("shows only the country for remote jobs, even when an older row stored a city", () => {
    expect(formatJobPlace({ workArrangement: "REMOTE", city: null, state: null, states: [], country: "US" })).toBe("United States");
    expect(formatJobPlace({ workArrangement: "REMOTE", city: null, state: null, states: [], country: "CA" })).toBe("Canada");
    expect(formatJobPlace({ workArrangement: "REMOTE", city: "Austin", state: "TX", states: ["TX"], country: "US" })).toBe("United States");
  });

  it("shows city, state and country for hybrid and on-site jobs", () => {
    expect(formatJobPlace({ workArrangement: "HYBRID", city: "McLean", state: "VA", states: ["VA"], country: "US" })).toBe("McLean, Virginia, United States");
    expect(formatJobPlace({ workArrangement: "ONSITE", city: "Toronto", state: null, states: ["ON"], country: "CA" })).toBe("Toronto, Ontario, Canada");
    expect(formatJobPlace({ workArrangement: "HYBRID", city: "Seattle", state: "WA", states: ["WA", "OR"], country: "US" })).toBe("Seattle · WA, OR · United States");
  });
});


describe("location search parsing", () => {
  it("matches region codes exactly and names by word prefix", () => {
    expect(matchRegions("ON")).toEqual(["ON"]);
    expect(matchRegions("in")).toEqual(["IN"]);
    expect(matchRegions("tex")).toEqual(["TX"]);
    expect(matchRegions("york")).toContain("NY");
    expect(matchRegions("on")).not.toContain("WA");
    expect(matchRegions("")).toEqual([]);
  });

  it("splits 'City, Region' and treats a bare code as a region", () => {
    expect(parseLocationQuery("Austin, TX")).toEqual({ city: "Austin", regions: ["TX"], regionOnly: true });
    expect(parseLocationQuery("Toronto, Ontario, Canada")).toEqual({ city: "Toronto", regions: ["ON"], regionOnly: true });
    expect(parseLocationQuery("ON")).toEqual({ city: null, regions: ["ON"], regionOnly: false });
    expect(parseLocationQuery("Seattle")).toEqual({ city: "Seattle", regions: [], regionOnly: false });
    expect(parseLocationQuery("Washington").regions).toEqual(["WA"]);
  });
});
