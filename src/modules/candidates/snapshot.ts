import type { CandidateProfile, CandidateSkill, Document, Skill } from "@prisma/client";
import { decimalToNumber, toDateInputValue } from "@/lib/format";

/**
 * Point-in-time copy of the candidate information submitted with an application.
 * Stored as JSON on the application so later profile edits never change history.
 */
export type CandidateSnapshot = {
  capturedAt: string;
  candidateDisplayId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  alternatePhone: string | null;
  country: string;
  state: string | null;
  city: string | null;
  postalCode: string | null;
  linkedinUrl: string | null;
  professionalTitle: string | null;
  currentTitle: string | null;
  currentEmployer: string | null;
  totalExperienceYears: number | null;
  relevantExperienceYears: number | null;
  primarySkills: string[];
  secondarySkills: string[];
  highestQualification: string | null;
  education: string | null;
  certifications: string[];
  preferredJobTitles: string[];
  preferredLocations: string[];
  preferredWorkArrangements: string[];
  preferredEmploymentTypes: string[];
  expectedCompensation: number | null;
  compensationType: string | null;
  currency: string | null;
  noticePeriodDays: number | null;
  availableFrom: string | null;
  workAuthCountry: string | null;
  workAuthStatus: string | null;
  resume: { documentId: string; fileName: string } | null;
};

export function buildCandidateSnapshot(
  profile: CandidateProfile & { skills: (CandidateSkill & { skill: Skill })[] },
  resume: Pick<Document, "id" | "fileName"> | null,
  capturedAt = new Date(),
): CandidateSnapshot {
  const skillsAt = (level: "PRIMARY" | "SECONDARY") =>
    profile.skills.filter((s) => s.level === level).map((s) => s.skill.name).sort();
  return {
    capturedAt: capturedAt.toISOString(),
    candidateDisplayId: profile.displayId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    alternatePhone: profile.alternatePhone,
    country: profile.country,
    state: profile.state,
    city: profile.city,
    postalCode: profile.postalCode,
    linkedinUrl: profile.linkedinUrl,
    professionalTitle: profile.professionalTitle,
    currentTitle: profile.currentTitle,
    currentEmployer: profile.currentEmployer,
    totalExperienceYears: profile.totalExperienceYears,
    relevantExperienceYears: profile.relevantExperienceYears,
    primarySkills: skillsAt("PRIMARY"),
    secondarySkills: skillsAt("SECONDARY"),
    highestQualification: profile.highestQualification,
    education: profile.education,
    certifications: [...profile.certifications],
    preferredJobTitles: [...profile.preferredJobTitles],
    preferredLocations: [...profile.preferredLocations],
    preferredWorkArrangements: [...profile.preferredWorkArrangements],
    preferredEmploymentTypes: [...profile.preferredEmploymentTypes],
    expectedCompensation: decimalToNumber(profile.expectedCompensation),
    compensationType: profile.compensationType,
    currency: profile.currency,
    noticePeriodDays: profile.noticePeriodDays,
    availableFrom: profile.availableFrom ? toDateInputValue(profile.availableFrom) : null,
    workAuthCountry: profile.workAuthCountry,
    workAuthStatus: profile.workAuthStatus,
    resume: resume ? { documentId: resume.id, fileName: resume.fileName } : null,
  };
}

export function parseSnapshot(value: unknown): CandidateSnapshot | null {
  return value && typeof value === "object" && "firstName" in value ? (value as CandidateSnapshot) : null;
}
