import type {
  ApplicationStatus,
  CompensationType,
  Country,
  Currency,
  DocumentType,
  EmploymentType,
  JobStatus,
  Qualification,
  Source,
  WorkArrangement,
  WorkAuthorizationStatus,
} from "@prisma/client";

type Labels<T extends string> = Record<T, string>;

export const COUNTRY_LABELS: Labels<Country> = { US: "United States", CA: "Canada", OTHER: "Other" };
export const JOB_COUNTRIES = ["US", "CA"] as const satisfies readonly Country[];
export const CURRENCY_LABELS: Labels<Currency> = { USD: "USD", CAD: "CAD" };
export const COMPENSATION_TYPE_LABELS: Labels<CompensationType> = { ANNUAL: "Annual salary", HOURLY: "Hourly rate" };

export const WORK_ARRANGEMENT_LABELS: Labels<WorkArrangement> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "On-site",
};

export const EMPLOYMENT_TYPE_LABELS: Labels<EmploymentType> = {
  FULL_TIME: "Full-time",
  CONTRACT: "Contract",
  PART_TIME: "Part-time",
};

export const JOB_STATUS_LABELS: Labels<JobStatus> = {
  DRAFT: "Draft",
  PUBLISHED: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};


export const SOURCE_LABELS: Labels<Source> = {
  JOB_PORTAL: "Job Portal",
  INTERNAL_RECRUITMENT: "Internal Recruitment",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export const QUALIFICATION_LABELS: Labels<Qualification> = {
  HIGH_SCHOOL: "High school",
  DIPLOMA: "Diploma / Certificate",
  ASSOCIATE: "Associate degree",
  BACHELOR: "Bachelor's degree",
  MASTER: "Master's degree",
  DOCTORATE: "Doctorate",
  OTHER: "Other",
};

export const WORK_AUTH_STATUS_LABELS: Labels<WorkAuthorizationStatus> = {
  CITIZEN: "Citizen",
  PERMANENT_RESIDENT: "Permanent resident / Green card holder",
  WORK_PERMIT: "Authorized with work permit / visa",
  REQUIRES_SPONSORSHIP: "Requires sponsorship",
  OTHER: "Other",
};

export const APPLICATION_STATUS_LABELS: Labels<ApplicationStatus> = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  SUBMITTED_TO_CLIENT: "Submitted to Client",
  INTERVIEW: "Interview",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const APPLICATION_STATUSES = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];

export const DOCUMENT_TYPE_LABELS: Labels<DocumentType> = {
  RESUME: "Resume",
  COVER_LETTER: "Cover letter",
  SUPPORTING: "Supporting document",
};

/** Convert a label map into <select> options. */
export function toOptions<T extends string>(labels: Labels<T>): { value: T; label: string }[] {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}
