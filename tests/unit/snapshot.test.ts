import { describe, expect, it } from "vitest";
import { buildCandidateSnapshot } from "@/modules/candidates/snapshot";

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
