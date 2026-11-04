import { describe, expect, it } from "vitest";
import { registerSchema, verifyEmailCodeSchema } from "@/modules/auth/schemas";
import { jobSchema } from "@/modules/jobs/schemas";
import { candidateSelfProfileSchema } from "@/modules/candidates/schemas";
import { applySchema } from "@/modules/applications/schemas";
import { EMPTY_JOB } from "@/modules/jobs/form-values";
import { EMPTY_STAFF_CANDIDATE } from "@/modules/candidates/form-values";

const uuid = "3f1c2b8e-5d4a-4c6b-9e7f-1a2b3c4d5e6f";

describe("registration", () => {
  const valid = {
    firstName: "John", lastName: "Smith", email: "John@Example.com", phone: "(416) 555-0100", country: "CA",
    password: "Secur3Password", confirmPassword: "Secur3Password", acceptPrivacy: true,
  };
  it("normalizes email and phone", () => {
    const result = registerSchema.parse(valid);
    expect(result.email).toBe("john@example.com");
    expect(result.phone).toBe("+14165550100");
  });
  it("requires matching, strong passwords and privacy consent", () => {
    expect(registerSchema.safeParse({ ...valid, confirmPassword: "nope" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, acceptPrivacy: false }).success).toBe(false);
  });
});

describe("sign-up verification code", () => {
  it("accepts the emailed code, ignoring spaces, and normalizes the email", () => {
    expect(verifyEmailCodeSchema.parse({ email: "Jo@Example.com", code: " 123 456 " })).toEqual({ email: "jo@example.com", code: "123456" });
  });
  it("rejects codes that are not 6-10 digits", () => {
    for (const code of ["", "12345", "12a456", "12345678901"]) {
      expect(verifyEmailCodeSchema.safeParse({ email: "jo@example.com", code }).success).toBe(false);
    }
  });
});

describe("job form", () => {
  const base = {
    ...EMPTY_JOB, title: "Senior Java Developer", description: "Build things", requiredSkills: ["Java"],
    country: "CA", state: "ON", city: "Toronto",
  };
  it("accepts a valid job and converts numbers", () => {
    const job = jobSchema.parse({ ...base, minExperience: "5", maxExperience: "8", compensationMin: "110000" });
    expect(job.minExperience).toBe(5);
    expect(job.compensationMin).toBe(110000);
    expect(job.applicationDeadline).toBeUndefined();
  });
  it("rejects max < min, wrong province and public salary without amounts", () => {
    expect(jobSchema.safeParse({ ...base, minExperience: "8", maxExperience: "5" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, state: "TX" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, salaryPublic: true }).success).toBe(false);
  });
  it("rejects an application deadline in the past", () => {
    expect(jobSchema.safeParse({ ...base, applicationDeadline: "2020-01-01" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, applicationDeadline: "2999-01-01" }).success).toBe(true);
  });
  it("requires at least one required skill", () => {
    expect(jobSchema.safeParse({ ...base, requiredSkills: [] }).success).toBe(false);
  });
});

describe("candidate profile", () => {
  const base = { ...EMPTY_STAFF_CANDIDATE, firstName: "Sarah", lastName: "Wilson", phone: "613-555-0102", country: "CA", state: "ON" };
  it("validates Canadian postal codes and US ZIP codes", () => {
    expect(candidateSelfProfileSchema.safeParse({ ...base, postalCode: "K1A 0B1" }).success).toBe(true);
    expect(candidateSelfProfileSchema.safeParse({ ...base, postalCode: "12345" }).success).toBe(false);
    expect(candidateSelfProfileSchema.safeParse({ ...base, country: "US", state: "NY", postalCode: "10001" }).success).toBe(true);
  });
  it("rejects relevant > total experience and duplicated skills", () => {
    expect(candidateSelfProfileSchema.safeParse({ ...base, totalExperienceYears: "3", relevantExperienceYears: "5" }).success).toBe(false);
    expect(candidateSelfProfileSchema.safeParse({ ...base, primarySkills: ["Java"], secondarySkills: ["java"] }).success).toBe(false);
  });
  it("only accepts LinkedIn URLs", () => {
    expect(candidateSelfProfileSchema.safeParse({ ...base, linkedinUrl: "https://evil.example/x" }).success).toBe(false);
    expect(candidateSelfProfileSchema.safeParse({ ...base, linkedinUrl: "https://www.linkedin.com/in/sarah" }).success).toBe(true);
  });
});

describe("apply form", () => {
  const base = { jobId: uuid, resumeChoice: "profile", availability: "2 weeks", confirmAccurate: true, supportingDocumentIds: [] };
  it("requires an upload when not using the profile resume", () => {
    expect(applySchema.safeParse(base).success).toBe(true);
    expect(applySchema.safeParse({ ...base, resumeChoice: "upload" }).success).toBe(false);
    expect(applySchema.safeParse({ ...base, resumeChoice: "upload", resumeDocumentId: uuid }).success).toBe(true);
  });
  it("requires confirmation", () => expect(applySchema.safeParse({ ...base, confirmAccurate: false }).success).toBe(false));
});

describe("server re-validation of client-parsed values", () => {
  // React Hook Form passes transformed output to the server action, which parses it again.
  it("job form output parses again (dates, numbers)", () => {
    const once = jobSchema.parse({
      ...EMPTY_JOB, title: "Dev", description: "x", requiredSkills: ["Go"], country: "CA", state: "ON", city: "Toronto",
      minExperience: "3", applicationDeadline: "2026-11-30",
    });
    expect(once.applicationDeadline).toBeInstanceOf(Date);
    const twice = jobSchema.parse(once);
    expect(twice.applicationDeadline?.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(twice.minExperience).toBe(3);
  });
  it("candidate profile output parses again (dates, phone)", () => {
    const once = candidateSelfProfileSchema.parse({
      ...EMPTY_STAFF_CANDIDATE, firstName: "A", lastName: "B", phone: "(416) 555-0100", country: "CA", availableFrom: "2026-12-01",
    });
    const twice = candidateSelfProfileSchema.parse(once);
    expect(twice.availableFrom?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(twice.phone).toBe("+14165550100");
  });
});
