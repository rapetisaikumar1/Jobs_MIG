import type { CandidateProfile, CandidateSkill, Skill } from "@prisma/client";
import { decimalToNumber, formatPhone, toDateInputValue } from "@/lib/format";
import type { CandidateSelfProfileFormValues } from "@/modules/candidates/schemas";

type ProfileWithSkills = CandidateProfile & { skills: (CandidateSkill & { skill: Skill })[] };

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** Converts a stored profile into serializable form values (strings for inputs). */
export function profileToFormValues(p: ProfileWithSkills): CandidateSelfProfileFormValues {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    // Shown as "+1 (416) 555-0100"; the schema normalizes it back on save.
    phone: p.phone ? formatPhone(p.phone) : "",
    alternatePhone: p.alternatePhone ? formatPhone(p.alternatePhone) : "",
    country: p.country,
    state: str(p.state),
    city: str(p.city),
    postalCode: str(p.postalCode),
    linkedinUrl: str(p.linkedinUrl),
    professionalTitle: str(p.professionalTitle),
    currentTitle: str(p.currentTitle),
    currentEmployer: str(p.currentEmployer),
    totalExperienceYears: str(p.totalExperienceYears),
    relevantExperienceYears: str(p.relevantExperienceYears),
    primarySkills: p.skills.filter((s) => s.level === "PRIMARY").map((s) => s.skill.name),
    secondarySkills: p.skills.filter((s) => s.level === "SECONDARY").map((s) => s.skill.name),
    highestQualification: str(p.highestQualification),
    education: str(p.education),
    certifications: p.certifications,
    preferredJobTitles: p.preferredJobTitles,
    preferredLocations: p.preferredLocations,
    preferredWorkArrangements: p.preferredWorkArrangements,
    preferredEmploymentTypes: p.preferredEmploymentTypes,
    expectedCompensation: str(decimalToNumber(p.expectedCompensation)),
    compensationType: str(p.compensationType),
    currency: str(p.currency),
    noticePeriodDays: str(p.noticePeriodDays),
    availableFrom: toDateInputValue(p.availableFrom),
    workAuthCountry: str(p.workAuthCountry),
    workAuthStatus: str(p.workAuthStatus),
  };
}

/** Blank profile form values. */
export const EMPTY_CANDIDATE_PROFILE: CandidateSelfProfileFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  alternatePhone: "",
  country: "US",
  state: "",
  city: "",
  postalCode: "",
  linkedinUrl: "",
  professionalTitle: "",
  currentTitle: "",
  currentEmployer: "",
  totalExperienceYears: "",
  relevantExperienceYears: "",
  primarySkills: [],
  secondarySkills: [],
  highestQualification: "",
  education: "",
  certifications: [],
  preferredJobTitles: [],
  preferredLocations: [],
  preferredWorkArrangements: [],
  preferredEmploymentTypes: [],
  expectedCompensation: "",
  compensationType: "",
  currency: "",
  noticePeriodDays: "",
  availableFrom: "",
  workAuthCountry: "",
  workAuthStatus: "",
};

/**
 * @deprecated Use EMPTY_CANDIDATE_PROFILE. Old name kept only because
 * src/app/candidate/profile/page.tsx still imports it.
 */
export const EMPTY_STAFF_CANDIDATE = EMPTY_CANDIDATE_PROFILE;
