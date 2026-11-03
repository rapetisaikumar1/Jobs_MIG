import type { CandidateProfile, CandidateSkill, Skill } from "@prisma/client";
import { decimalToNumber, toDateInputValue } from "@/lib/format";
import type { CandidateSelfProfileFormValues, StaffCandidateFormValues } from "@/modules/candidates/schemas";

type ProfileWithSkills = CandidateProfile & { skills: (CandidateSkill & { skill: Skill })[] };

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** Converts a stored profile into serializable form values (strings for inputs). */
export function profileToFormValues(p: ProfileWithSkills): CandidateSelfProfileFormValues {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone ?? "",
    alternatePhone: str(p.alternatePhone),
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

export function staffProfileToFormValues(p: ProfileWithSkills): StaffCandidateFormValues {
  return {
    ...profileToFormValues(p),
    email: p.email,
    source: p.source,
    profileOwnerId: str(p.profileOwnerId),
    internalNotes: str(p.internalNotes),
    documentIds: [],
    confirmNotDuplicate: false,
  };
}

export const EMPTY_STAFF_CANDIDATE: StaffCandidateFormValues = {
  firstName: "",
  lastName: "",
  email: "",
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
  source: "INTERNAL_RECRUITMENT",
  profileOwnerId: "",
  internalNotes: "",
  documentIds: [],
  confirmNotDuplicate: false,
};
