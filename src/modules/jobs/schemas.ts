import { z } from "zod";
import {
  COMPENSATION_TYPE_LABELS,
  CURRENCY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  WORK_ARRANGEMENT_LABELS,
} from "@/config/options";
import { regionsFor } from "@/config/locations";
import {
  checkbox,
  enumValues,
  optionalDate,
  optionalNumber,
  optionalText,
  optionalUuid,
  requiredText,
  stringList,
  uuid,
} from "@/lib/validation";

export const jobSchema = z
  .object({
    title: requiredText("Job title", 160),
    description: requiredText("Job description", 20000),
    responsibilities: optionalText(20000),
    requiredSkills: stringList(30, 60).refine((v) => v.length > 0, "Add at least one required skill"),
    preferredSkills: stringList(30, 60),
    minExperience: optionalNumber(0, 50, { integer: true }),
    maxExperience: optionalNumber(0, 50, { integer: true }),
    education: optionalText(1000),
    country: z.enum(["US", "CA"], { error: "Select United States or Canada" }),
    state: requiredText("State / Province", 60),
    city: requiredText("City", 100),
    workArrangement: z.enum(enumValues(WORK_ARRANGEMENT_LABELS), { error: "Select a work arrangement" }),
    employmentType: z.enum(enumValues(EMPLOYMENT_TYPE_LABELS), { error: "Select an employment type" }),
    compensationMin: optionalNumber(0, 10_000_000),
    compensationMax: optionalNumber(0, 10_000_000),
    currency: z.enum(enumValues(CURRENCY_LABELS)),
    compensationType: z.enum(enumValues(COMPENSATION_TYPE_LABELS)),
    salaryPublic: checkbox,
    applicationDeadline: optionalDate,
    assignedRecruiterId: optionalUuid,
    groupIds: z.array(uuid).max(50).default([]),
    internalNotes: optionalText(5000),
    isFeatured: checkbox,
  })
  .superRefine((v, ctx) => {
    if (v.minExperience != null && v.maxExperience != null && v.maxExperience < v.minExperience) {
      ctx.addIssue({ code: "custom", path: ["maxExperience"], message: "Must be at least the minimum" });
    }
    if (v.compensationMin != null && v.compensationMax != null && v.compensationMax < v.compensationMin) {
      ctx.addIssue({ code: "custom", path: ["compensationMax"], message: "Must be at least the minimum" });
    }
    if (!regionsFor(v.country).some((r) => r.code === v.state)) {
      ctx.addIssue({ code: "custom", path: ["state"], message: "Select a valid state or province" });
    }
    if (v.salaryPublic && v.compensationMin == null && v.compensationMax == null) {
      ctx.addIssue({ code: "custom", path: ["salaryPublic"], message: "Enter a salary or rate before making it public" });
    }
  });

export type JobInput = z.output<typeof jobSchema>;
export type JobFormValues = z.input<typeof jobSchema>;
