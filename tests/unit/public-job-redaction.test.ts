import { describe, expect, it } from "vitest";
import { formatJobLocation, jobStates, matchRegions, parseLocationQuery } from "@/config/locations";
import { redactHiddenSalary } from "@/modules/jobs/queries";

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
