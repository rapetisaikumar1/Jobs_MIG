import type { Job, JobSkill, Skill } from "@prisma/client";
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
  country: "US",
  state: "",
  city: "",
  workArrangement: "HYBRID",
  employmentType: "FULL_TIME",
  compensationMin: "",
  compensationMax: "",
  currency: "USD",
  compensationType: "ANNUAL",
  salaryPublic: false,
  applicationDeadline: "",
  assignedRecruiterId: "",
  internalNotes: "",
  isFeatured: false,
};

export function jobToFormValues(job: Job & { skills: (JobSkill & { skill: Skill })[] }): JobFormValues {
  return {
    title: job.title,
    description: job.description,
    responsibilities: str(job.responsibilities),
    requiredSkills: job.skills.filter((s) => s.type === "REQUIRED").map((s) => s.skill.name),
    preferredSkills: job.skills.filter((s) => s.type === "PREFERRED").map((s) => s.skill.name),
    minExperience: str(job.minExperience),
    maxExperience: str(job.maxExperience),
    education: str(job.education),
    country: job.country === "CA" ? "CA" : "US",
    state: job.state,
    city: job.city,
    workArrangement: job.workArrangement,
    employmentType: job.employmentType,
    compensationMin: str(decimalToNumber(job.compensationMin)),
    compensationMax: str(decimalToNumber(job.compensationMax)),
    currency: job.currency,
    compensationType: job.compensationType,
    salaryPublic: job.salaryPublic,
    applicationDeadline: toDateInputValue(job.applicationDeadline),
    assignedRecruiterId: str(job.assignedRecruiterId),
    internalNotes: str(job.internalNotes),
    isFeatured: job.isFeatured,
  };
}
