// Advanced candidate search: structured relational filters (indexed columns, skill
// joins) combined with PostgreSQL full-text search. Covers portal and internal candidates.

import type {
  ApplicationStatus,
  CompensationType,
  Country,
  Currency,
  EmploymentType,
  Prisma,
  Qualification,
  Source,
  WorkArrangement,
  WorkAuthorizationStatus,
} from "@prisma/client";
import {
  APPLICATION_STATUS_LABELS,
  COMPENSATION_TYPE_LABELS,
  COUNTRY_LABELS,
  CURRENCY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  QUALIFICATION_LABELS,
  SOURCE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  WORK_AUTH_STATUS_LABELS,
} from "@/config/options";
import { cleanList, parseDateInput, skillSlug } from "@/lib/format";
import { param, paramList, type SearchParams } from "@/lib/pagination";

export const SEARCH_SORTS = {
  updated: "Recently updated",
  newest: "Newest profiles",
  experience: "Most experience",
  name: "Name (A–Z)",
} as const;
export type SearchSort = keyof typeof SEARCH_SORTS;

export type CandidateSearchFilters = {
  q?: string;
  name?: string;
  email?: string;
  phone?: string;
  candidateId?: string;
  skills: string[];
  primarySkills: string[];
  currentTitle?: string;
  minExp?: number;
  maxExp?: number;
  minRelevantExp?: number;
  country?: Country;
  state?: string;
  city?: string;
  preferredLocation?: string;
  workArrangement?: WorkArrangement;
  employmentType?: EmploymentType;
  minSalary?: number;
  maxSalary?: number;
  currency?: Currency;
  compensationType?: CompensationType;
  availableWithinDays?: number;
  workAuthCountry?: Country;
  workAuthStatus?: WorkAuthorizationStatus;
  qualification?: Qualification;
  education?: string;
  certification?: string;
  source?: Source;
  applicationStatus?: ApplicationStatus;
  jobId?: string;
  appliedFrom?: Date;
  appliedTo?: Date;
  sort: SearchSort;
};

function oneOf<T extends string>(labels: Record<T, string>, value: string | undefined): T | undefined {
  return value && value in labels ? (value as T) : undefined;
}

function num(value: string | undefined, max = 10_000_000): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
}

function text(value: string | undefined, max = 120): string | undefined {
  return value ? value.slice(0, max) : undefined;
}

/** Lenient parse of URL search params: invalid values are ignored rather than erroring. */
export function parseCandidateSearch(params: SearchParams): CandidateSearchFilters {
  return {
    q: text(param(params, "q"), 200),
    name: text(param(params, "name")),
    email: text(param(params, "email")),
    phone: text(param(params, "phone"), 30),
    candidateId: text(param(params, "candidateId"), 30),
    skills: cleanList(paramList(params, "skills")).slice(0, 15),
    primarySkills: cleanList(paramList(params, "primarySkills")).slice(0, 15),
    currentTitle: text(param(params, "currentTitle")),
    minExp: num(param(params, "minExp"), 60),
    maxExp: num(param(params, "maxExp"), 60),
    minRelevantExp: num(param(params, "minRelevantExp"), 60),
    country: oneOf(COUNTRY_LABELS, param(params, "country")),
    state: text(param(params, "state"), 60),
    city: text(param(params, "city")),
    preferredLocation: text(param(params, "preferredLocation")),
    workArrangement: oneOf(WORK_ARRANGEMENT_LABELS, param(params, "workArrangement")),
    employmentType: oneOf(EMPLOYMENT_TYPE_LABELS, param(params, "employmentType")),
    minSalary: num(param(params, "minSalary")),
    maxSalary: num(param(params, "maxSalary")),
    currency: oneOf(CURRENCY_LABELS, param(params, "currency")),
    compensationType: oneOf(COMPENSATION_TYPE_LABELS, param(params, "compensationType")),
    availableWithinDays: num(param(params, "availableWithinDays"), 365),
    workAuthCountry: oneOf(COUNTRY_LABELS, param(params, "workAuthCountry")),
    workAuthStatus: oneOf(WORK_AUTH_STATUS_LABELS, param(params, "workAuthStatus")),
    qualification: oneOf(QUALIFICATION_LABELS, param(params, "qualification")),
    education: text(param(params, "education")),
    certification: text(param(params, "certification")),
    source: oneOf(SOURCE_LABELS, param(params, "source")),
    applicationStatus: oneOf(APPLICATION_STATUS_LABELS, param(params, "applicationStatus")),
    jobId: text(param(params, "jobId"), 30)?.toUpperCase(),
    appliedFrom: parseDateInput(param(params, "appliedFrom")) ?? undefined,
    appliedTo: parseDateInput(param(params, "appliedTo")) ?? undefined,
    sort: oneOf(SEARCH_SORTS, param(params, "sort")) ?? "updated",
  };
}

export function hasAnyFilter(f: CandidateSearchFilters): boolean {
  return Object.entries(f).some(([key, value]) =>
    key === "sort" ? false : Array.isArray(value) ? value.length > 0 : value !== undefined,
  );
}

const ci = "insensitive" as const;

/** Filters that need raw SQL (full-text and array substring) and produce candidate id lists. */
export type RawIdFilters = { keywordIds?: string[]; preferredLocationIds?: string[]; certificationIds?: string[] };

/**
 * Builds the Prisma filter for a search. All filters combine with AND.
 * Skill filters require every listed skill (e.g. Java AND Spring Boot AND AWS).
 * Application filters (status, job, applied date) must match the same application
 * and only consider applications within the user's access scope.
 */
export function buildCandidateSearchWhere(
  f: CandidateSearchFilters,
  options: { applicationScope: Prisma.ApplicationWhereInput; raw?: RawIdFilters; now?: Date },
): Prisma.CandidateProfileWhereInput {
  const and: Prisma.CandidateProfileWhereInput[] = [];
  const raw = options.raw ?? {};
  for (const ids of [raw.keywordIds, raw.preferredLocationIds, raw.certificationIds]) {
    if (ids) and.push({ id: { in: ids } });
  }

  if (f.name) {
    for (const token of f.name.split(/\s+/).filter(Boolean).slice(0, 4)) {
      and.push({ OR: [{ firstName: { contains: token, mode: ci } }, { lastName: { contains: token, mode: ci } }] });
    }
  }
  if (f.email) and.push({ email: { contains: f.email, mode: ci } });
  if (f.phone) {
    const digits = f.phone.replace(/\D/g, "");
    if (digits) and.push({ OR: [{ phone: { contains: digits } }, { alternatePhone: { contains: digits } }] });
  }
  if (f.candidateId) and.push({ displayId: { contains: f.candidateId, mode: ci } });

  for (const skill of f.primarySkills) {
    and.push({ skills: { some: { level: "PRIMARY", skill: { slug: skillSlug(skill) } } } });
  }
  for (const skill of f.skills) {
    and.push({ skills: { some: { skill: { slug: skillSlug(skill) } } } });
  }

  if (f.currentTitle) {
    and.push({
      OR: [
        { currentTitle: { contains: f.currentTitle, mode: ci } },
        { professionalTitle: { contains: f.currentTitle, mode: ci } },
      ],
    });
  }
  if (f.minExp !== undefined) and.push({ totalExperienceYears: { gte: f.minExp } });
  if (f.maxExp !== undefined) and.push({ totalExperienceYears: { lte: f.maxExp } });
  if (f.minRelevantExp !== undefined) and.push({ relevantExperienceYears: { gte: f.minRelevantExp } });

  if (f.country) and.push({ country: f.country });
  if (f.state) and.push({ state: { equals: f.state, mode: ci } });
  if (f.city) and.push({ city: { contains: f.city, mode: ci } });
  if (f.workArrangement) and.push({ preferredWorkArrangements: { has: f.workArrangement } });
  if (f.employmentType) and.push({ preferredEmploymentTypes: { has: f.employmentType } });

  if (f.minSalary !== undefined) and.push({ expectedCompensation: { gte: f.minSalary } });
  if (f.maxSalary !== undefined) and.push({ expectedCompensation: { lte: f.maxSalary } });
  if (f.currency) and.push({ currency: f.currency });
  if (f.compensationType) and.push({ compensationType: f.compensationType });

  if (f.availableWithinDays !== undefined) {
    const now = options.now ?? new Date();
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + f.availableWithinDays));
    and.push({ OR: [{ noticePeriodDays: { lte: f.availableWithinDays } }, { availableFrom: { lte: cutoff } }] });
  }

  if (f.workAuthCountry) and.push({ workAuthCountry: f.workAuthCountry });
  if (f.workAuthStatus) and.push({ workAuthStatus: f.workAuthStatus });
  if (f.qualification) and.push({ highestQualification: f.qualification });
  if (f.education) and.push({ education: { contains: f.education, mode: ci } });
  if (f.source) and.push({ source: f.source });

  if (f.applicationStatus || f.jobId || f.appliedFrom || f.appliedTo) {
    const appliedAt: Prisma.DateTimeFilter = {};
    if (f.appliedFrom) appliedAt.gte = f.appliedFrom;
    if (f.appliedTo) appliedAt.lt = new Date(f.appliedTo.getTime() + 24 * 60 * 60 * 1000); // inclusive end date
    and.push({
      applications: {
        some: {
          AND: [
            options.applicationScope,
            f.applicationStatus ? { status: f.applicationStatus } : {},
            f.jobId ? { job: { displayId: f.jobId } } : {},
            f.appliedFrom || f.appliedTo ? { appliedAt } : {},
          ],
        },
      },
    });
  }

  return and.length ? { AND: and } : {};
}

export function searchOrderBy(sort: SearchSort): Prisma.CandidateProfileOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }];
    case "experience":
      return [{ totalExperienceYears: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }];
    case "name":
      return [{ lastName: "asc" }, { firstName: "asc" }];
    default:
      return [{ updatedAt: "desc" }];
  }
}

/** Escape LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Search-as-you-type keyword query: every word must match and the last word matches
 * as a prefix ("java spr" → java & spr:*). Returns null when the user typed search
 * syntax (quotes, OR, -exclusions) so the caller uses websearch_to_tsquery instead.
 */
export function prefixTsQuery(q: string): string | null {
  if (/["]|\bor\b|(^|\s)-/i.test(q)) return null;
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!words.length) return null;
  return words.map((w, i) => (i === words.length - 1 ? `${w}:*` : w)).join(" & ");
}
