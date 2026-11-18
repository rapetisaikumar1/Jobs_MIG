import type { Job, JobSkill, Skill } from "@prisma/client";
import { jobStates } from "@/config/locations";
import { decimalToNumber, toDateInputValue } from "@/lib/format";
import type { JobFormValues } from "@/modules/jobs/schemas";

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export const EMPTY_JOB: JobFormValues = {
  title: "",
  description: "",
  responsibilities: "",
  requiredSkills: [],
  preferredSkills: [],
  minExperience: "",
  maxExperience: "",
  education: "",
  clientId: "",
  country: "US",
  states: [],
  city: "",
  workArrangement: "HYBRID",
  employmentType: "FULL_TIME",
  compensationMin: "",
  compensationMax: "",
  currency: "USD",
  compensationType: "ANNUAL",
  salaryPublic: false,
  applicationDeadline: "",
};

/** Retired job columns that are no longer read (see prisma/schema.prisma). */
type RetiredJobFields = "isFeatured" | "assignedRecruiterId" | "internalNotes";

export function jobToFormValues(job: Omit<Job, RetiredJobFields> & { skills: (JobSkill & { skill: Skill })[] }): JobFormValues {
  // Remote jobs have no city or state. Older remote rows may still hold one: it is not shown, so
  // switching the job to hybrid / on-site starts from empty (required) location fields.
  const remote = job.workArrangement === "REMOTE";
  return {
    title: job.title,
    description: job.description,
    responsibilities: str(job.responsibilities),
    requiredSkills: job.skills.filter((s) => s.type === "REQUIRED").map((s) => s.skill.name),
    preferredSkills: job.skills.filter((s) => s.type === "PREFERRED").map((s) => s.skill.name),
    minExperience: str(job.minExperience),
    maxExperience: str(job.maxExperience),
    education: str(job.education),
    clientId: job.clientId ?? "",
    country: job.country === "CA" ? "CA" : "US",
    states: remote ? [] : jobStates(job),
    city: remote ? "" : str(job.city),
    workArrangement: job.workArrangement,
    employmentType: job.employmentType,
    compensationMin: str(decimalToNumber(job.compensationMin)),
    compensationMax: str(decimalToNumber(job.compensationMax)),
    currency: job.currency,
    compensationType: job.compensationType,
    salaryPublic: job.salaryPublic,
    applicationDeadline: toDateInputValue(job.applicationDeadline),
  };
}
