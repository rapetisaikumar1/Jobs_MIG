import { z } from "zod";
import { openDeadlineCutoff } from "@/lib/format";
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
    // Internal only: the client the job is for (never shown on the job portal). Empty = no client.
    clientId: optionalUuid,
    // Remote jobs: the country candidates must be eligible to work in. Hybrid / on-site: where the job is.
    country: z.enum(["US", "CA"], { error: "Select United States or Canada" }),
    // Hybrid / on-site only: every state / province the job is open in (at least one, checked
    // below). The first is also stored as the single "state" column for older code.
    states: z
      .array(z.string().trim().max(60), { error: "Select at least one state or province" })
      .max(80, "Select at most 80 states or provinces")
      .transform((v) => [...new Set(v)]),
    // Hybrid / on-site only (required for those, checked below).
    city: optionalText(100),
    workArrangement: z.enum(enumValues(WORK_ARRANGEMENT_LABELS), { error: "Select a work arrangement" }),
    employmentType: z.enum(enumValues(EMPLOYMENT_TYPE_LABELS), { error: "Select an employment type" }),
    compensationMin: optionalNumber(0, 10_000_000),
    compensationMax: optionalNumber(0, 10_000_000),
    currency: z.enum(enumValues(CURRENCY_LABELS)),
    compensationType: z.enum(enumValues(COMPENSATION_TYPE_LABELS)),
    salaryPublic: checkbox,
    applicationDeadline: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.minExperience != null && v.maxExperience != null && v.maxExperience < v.minExperience) {
      ctx.addIssue({ code: "custom", path: ["maxExperience"], message: "Must be at least the minimum" });
    }
    if (v.compensationMin != null && v.compensationMax != null && v.compensationMax < v.compensationMin) {
      ctx.addIssue({ code: "custom", path: ["compensationMax"], message: "Must be at least the minimum" });
    }
    // Remote jobs have no city or state: whatever the hidden fields still hold is ignored.
    if (v.workArrangement !== "REMOTE") {
      const regions = regionsFor(v.country);
      if (!v.states.length) {
        ctx.addIssue({ code: "custom", path: ["states"], message: "Select at least one state or province" });
      } else if (!v.states.every((code) => regions.some((r) => r.code === code))) {
        ctx.addIssue({ code: "custom", path: ["states"], message: "Select valid states or provinces for the country" });
      }
      if (!v.city) ctx.addIssue({ code: "custom", path: ["city"], message: "City is required" });
    }
    if (v.applicationDeadline && v.applicationDeadline < openDeadlineCutoff()) {
      ctx.addIssue({ code: "custom", path: ["applicationDeadline"], message: "The deadline cannot be in the past" });
    }
    if (v.salaryPublic && v.compensationMin == null && v.compensationMax == null) {
      ctx.addIssue({ code: "custom", path: ["salaryPublic"], message: "Enter a salary or rate before making it public" });
    }
  })
  // Remote jobs never save a city or state, so a stale location can never show.
  .transform((v) =>
    v.workArrangement === "REMOTE" ? { ...v, states: [] as string[], city: null } : { ...v, city: v.city ?? null },
  );

export type JobInput = z.output<typeof jobSchema>;
export type JobFormValues = z.input<typeof jobSchema>;
