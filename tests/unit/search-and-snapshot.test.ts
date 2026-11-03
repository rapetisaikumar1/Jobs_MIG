import { describe, expect, it } from "vitest";
import { buildCandidateSearchWhere, escapeLike, hasAnyFilter, parseCandidateSearch } from "@/modules/search/candidate-search";
import { buildCandidateSnapshot } from "@/modules/candidates/snapshot";

describe("advanced search filters", () => {
  it("parses the 'Java developers in Canada, 5–8 years, Spring Boot and AWS' example", () => {
    const f = parseCandidateSearch({ country: "CA", primarySkills: "Java", skills: "Spring Boot, AWS", minExp: "5", maxExp: "8" });
    expect(f).toMatchObject({ country: "CA", primarySkills: ["Java"], skills: ["Spring Boot", "AWS"], minExp: 5, maxExp: 8 });
    const where = buildCandidateSearchWhere(f, { applicationScope: {} });
    const and = (where.AND as object[]) ?? [];
    expect(and).toContainEqual({ skills: { some: { level: "PRIMARY", skill: { slug: "java" } } } });
    expect(and).toContainEqual({ skills: { some: { skill: { slug: "spring boot" } } } });
    expect(and).toContainEqual({ skills: { some: { skill: { slug: "aws" } } } });
    expect(and).toContainEqual({ totalExperienceYears: { gte: 5 } });
    expect(and).toContainEqual({ totalExperienceYears: { lte: 8 } });
    expect(and).toContainEqual({ country: "CA" });
  });

  it("supports availability within N days and contract preference", () => {
    const f = parseCandidateSearch({ availableWithinDays: "30", employmentType: "CONTRACT" });
    const where = buildCandidateSearchWhere(f, { applicationScope: {}, now: new Date("2026-11-03T12:00:00Z") });
    const and = where.AND as object[];
    expect(and).toContainEqual({ preferredEmploymentTypes: { has: "CONTRACT" } });
    expect(and).toContainEqual({
      OR: [{ noticePeriodDays: { lte: 30 } }, { availableFrom: { lte: new Date("2026-12-03T00:00:00Z") } }],
    });
  });

  it("matches application filters on the same, in-scope application", () => {
    const scope = { assignedRecruiterId: "me" };
    const f = parseCandidateSearch({ applicationStatus: "SHORTLISTED", jobId: "mig-job-000001" });
    const and = buildCandidateSearchWhere(f, { applicationScope: scope }).AND as { applications?: { some: { AND: object[] } } }[];
    const app = and.find((c) => c.applications)!.applications!.some.AND;
    expect(app).toContainEqual(scope);
    expect(app).toContainEqual({ status: "SHORTLISTED" });
    expect(app).toContainEqual({ job: { displayId: "MIG-JOB-000001" } });
  });

  it("ignores invalid values instead of failing", () => {
    const f = parseCandidateSearch({ country: "XX", minExp: "-3", source: "HACK" });
    expect(hasAnyFilter(f)).toBe(false);
  });

  it("escapes LIKE wildcards", () => expect(escapeLike("100%_\\")).toBe("100\\%\\_\\\\"));
});

describe("application snapshot", () => {
  it("is a detached copy of the profile at submission time", () => {
    const profile = {
      id: "c1", displayId: "MIG-CAN-000001", userId: null, source: "JOB_PORTAL", firstName: "John", lastName: "Smith",
      email: "john@example.com", phone: "+14165550100", alternatePhone: null, country: "CA", state: "ON", city: "Toronto",
      postalCode: null, linkedinUrl: null, professionalTitle: "Java Dev", currentTitle: "Java Dev", currentEmployer: null,
      totalExperienceYears: 6, relevantExperienceYears: 5, highestQualification: "BACHELOR", education: null,
      certifications: ["AWS"], preferredJobTitles: [], preferredLocations: [], preferredWorkArrangements: ["HYBRID"],
      preferredEmploymentTypes: ["FULL_TIME"], expectedCompensation: { toNumber: () => 125000 }, compensationType: "ANNUAL",
      currency: "CAD", noticePeriodDays: 14, availableFrom: null, workAuthCountry: "CA", workAuthStatus: "CITIZEN",
      profileOwnerId: null, internalNotes: "INTERNAL", createdById: null, defaultResumeId: null, createdAt: new Date(), updatedAt: new Date(),
      skills: [{ candidateId: "c1", skillId: "s1", level: "PRIMARY", skill: { id: "s1", name: "Java", slug: "java" } }],
    } as unknown as Parameters<typeof buildCandidateSnapshot>[0];

    const snap = buildCandidateSnapshot(profile, { id: "d1", fileName: "cv.pdf" });
    profile.firstName = "Changed";
    profile.certifications.push("New cert");
    expect(snap.firstName).toBe("John");
    expect(snap.certifications).toEqual(["AWS"]);
    expect(snap.primarySkills).toEqual(["Java"]);
    expect(snap.expectedCompensation).toBe(125000);
    expect(JSON.stringify(snap)).not.toContain("INTERNAL");
  });
});

describe("search-as-you-type keyword query", () => {
  it("matches the last word as a prefix", async () => {
    const { prefixTsQuery } = await import("@/modules/search/candidate-search");
    expect(prefixTsQuery("Jav")).toBe("jav:*");
    expect(prefixTsQuery("data  eng")).toBe("data & eng:*");
  });
  it("strips characters that would be tsquery syntax", async () => {
    const { prefixTsQuery } = await import("@/modules/search/candidate-search");
    expect(prefixTsQuery("c++ & (aws) | :*")).toBe("c & aws:*");
    expect(prefixTsQuery("!!!")).toBeNull();
  });
  it("defers to web-search syntax for quotes, OR and exclusions", async () => {
    const { prefixTsQuery } = await import("@/modules/search/candidate-search");
    expect(prefixTsQuery('"data engineer"')).toBeNull();
    expect(prefixTsQuery("java or kotlin")).toBeNull();
    expect(prefixTsQuery("java -android")).toBeNull();
  });
});
