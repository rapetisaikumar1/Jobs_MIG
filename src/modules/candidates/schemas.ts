import { z } from "zod";
import {
  COMPENSATION_TYPE_LABELS,
  COUNTRY_LABELS,
  CURRENCY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  QUALIFICATION_LABELS,
  SOURCE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  WORK_AUTH_STATUS_LABELS,
} from "@/config/options";
import { regionsFor } from "@/config/locations";
import {
  checkbox,
  email,
  enumValues,
  optionalDate,
  optionalEnum,
  optionalNumber,
  optionalPhone,
  optionalText,
  optionalUrl,
  optionalUuid,
  phone,
  requiredText,
  stringList,
  uuid,
} from "@/lib/validation";

const POSTAL_PATTERNS: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
};

/** Profile fields shared by the candidate portal and the admin portal. */
export const candidateProfileFields = {
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
  phone,
  alternatePhone: optionalPhone,
  country: z.enum(enumValues(COUNTRY_LABELS), { error: "Select a country" }),
  state: optionalText(60),
  city: optionalText(100),
  postalCode: optionalText(12),
  linkedinUrl: optionalUrl.refine(
    (v) => !v || /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(v),
    "Enter a LinkedIn profile URL (https://www.linkedin.com/in/...)",
  ),
  professionalTitle: optionalText(120),
  currentTitle: optionalText(120),
  currentEmployer: optionalText(120),
  totalExperienceYears: optionalNumber(0, 60),
  relevantExperienceYears: optionalNumber(0, 60),
  primarySkills: stringList(30, 60),
  secondarySkills: stringList(30, 60),
  highestQualification: optionalEnum(enumValues(QUALIFICATION_LABELS)),
  education: optionalText(2000),
  certifications: stringList(30, 120),
  preferredJobTitles: stringList(10, 120),
  preferredLocations: stringList(10, 120),
  preferredWorkArrangements: z.array(z.enum(enumValues(WORK_ARRANGEMENT_LABELS))).max(3).default([]),
  preferredEmploymentTypes: z.array(z.enum(enumValues(EMPLOYMENT_TYPE_LABELS))).max(3).default([]),
  expectedCompensation: optionalNumber(0, 10_000_000),
  compensationType: optionalEnum(enumValues(COMPENSATION_TYPE_LABELS)),
  currency: optionalEnum(enumValues(CURRENCY_LABELS)),
  noticePeriodDays: optionalNumber(0, 365, { integer: true }),
  availableFrom: optionalDate,
  workAuthCountry: optionalEnum(enumValues(COUNTRY_LABELS)),
  workAuthStatus: optionalEnum(enumValues(WORK_AUTH_STATUS_LABELS)),
};

type ProfileShape = {
  country: string;
  state?: string;
  postalCode?: string;
  relevantExperienceYears?: number;
  totalExperienceYears?: number;
  expectedCompensation?: number;
  currency?: string;
  compensationType?: string;
  primarySkills: string[];
  secondarySkills: string[];
};

function refineProfile(v: ProfileShape, ctx: z.RefinementCtx) {
  const regions = regionsFor(v.country);
  if (regions.length && v.state && !regions.some((r) => r.code === v.state)) {
    ctx.addIssue({ code: "custom", path: ["state"], message: "Select a valid state or province" });
  }
  const pattern = POSTAL_PATTERNS[v.country];
  if (pattern && v.postalCode && !pattern.test(v.postalCode)) {
    ctx.addIssue({
      code: "custom",
      path: ["postalCode"],
      message: v.country === "US" ? "Enter a ZIP code like 10001" : "Enter a postal code like M5V 2T6",
    });
  }
  if (
    v.relevantExperienceYears != null &&
    v.totalExperienceYears != null &&
    v.relevantExperienceYears > v.totalExperienceYears
  ) {
    ctx.addIssue({ code: "custom", path: ["relevantExperienceYears"], message: "Cannot exceed total experience" });
  }
  if (v.expectedCompensation != null && (!v.currency || !v.compensationType)) {
    ctx.addIssue({ code: "custom", path: ["currency"], message: "Select a currency and salary/rate type" });
  }
  const primary = new Set(v.primarySkills.map((s) => s.toLowerCase()));
  if (v.secondarySkills.some((s) => primary.has(s.toLowerCase()))) {
    ctx.addIssue({ code: "custom", path: ["secondarySkills"], message: "A skill cannot be both primary and secondary" });
  }
}

/** Candidate editing their own profile on the portal (email is managed by the account). */
export const candidateSelfProfileSchema = z.object(candidateProfileFields).superRefine(refineProfile);

/** Staff creating or editing a candidate record. */
export const staffCandidateSchema = z
  .object({
    ...candidateProfileFields,
    email,
    source: z.enum(enumValues(SOURCE_LABELS)),
    profileOwnerId: optionalUuid,
    internalNotes: optionalText(5000),
    /** Pending uploads (resume first) to attach to the profile. */
    documentIds: z.array(uuid).max(10).default([]),
    /** Recruiter confirmed the record is not a duplicate of a similar existing profile. */
    confirmNotDuplicate: checkbox,
  })
  .superRefine(refineProfile);

export type CandidateSelfProfileInput = z.output<typeof candidateSelfProfileSchema>;
export type CandidateSelfProfileFormValues = z.input<typeof candidateSelfProfileSchema>;
export type StaffCandidateInput = z.output<typeof staffCandidateSchema>;
export type StaffCandidateFormValues = z.input<typeof staffCandidateSchema>;
