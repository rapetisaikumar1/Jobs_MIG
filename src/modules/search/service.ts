import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pageArgs } from "@/lib/pagination";
import type { StaffContext } from "@/modules/access-control/context";
import { applicationScopeWhere } from "@/modules/access-control/scope";
import { candidateListSelect } from "@/modules/candidates/queries";
import {
  buildCandidateSearchWhere,
  prefixTsQuery,
  escapeLike,
  searchOrderBy,
  type CandidateSearchFilters,
  type RawIdFilters,
} from "@/modules/search/candidate-search";

const RAW_ID_LIMIT = 10_000;

async function idsByKeyword(q: string): Promise<string[]> {
  const prefix = prefixTsQuery(q);
  const rows = prefix
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM candidate_profiles
        WHERE search_vector @@ to_tsquery('english', ${prefix})
        LIMIT ${RAW_ID_LIMIT}`
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM candidate_profiles
        WHERE search_vector @@ websearch_to_tsquery('english', ${q})
        LIMIT ${RAW_ID_LIMIT}`;
  return rows.map((r) => r.id);
}

// Column names cannot be parameterized; only these whitelisted identifiers are ever interpolated.
const ARRAY_COLUMNS = { preferredLocations: "preferred_locations", certifications: "certifications" } as const;

async function idsByArrayText(column: keyof typeof ARRAY_COLUMNS, value: string): Promise<string[]> {
  const pattern = `%${escapeLike(value)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM candidate_profiles
    WHERE EXISTS (SELECT 1 FROM unnest(${Prisma.raw(ARRAY_COLUMNS[column])}) AS v WHERE v ILIKE ${pattern})
    LIMIT ${RAW_ID_LIMIT}`;
  return rows.map((r) => r.id);
}

export async function searchCandidates(ctx: StaffContext, filters: CandidateSearchFilters, page: number, pageSize = 25) {
  const raw: RawIdFilters = {};
  if (filters.q) raw.keywordIds = await idsByKeyword(filters.q);
  if (filters.preferredLocation) raw.preferredLocationIds = await idsByArrayText("preferredLocations", filters.preferredLocation);
  if (filters.certification) raw.certificationIds = await idsByArrayText("certifications", filters.certification);

  const scope = applicationScopeWhere(ctx);
  const where = buildCandidateSearchWhere(filters, { applicationScope: scope, raw });

  const [total, rows] = await Promise.all([
    prisma.candidateProfile.count({ where }),
    prisma.candidateProfile.findMany({
      where,
      orderBy: searchOrderBy(filters.sort),
      ...pageArgs(page, pageSize),
      select: {
        ...candidateListSelect,
        applications: {
          where: scope,
          orderBy: { appliedAt: "desc" },
          take: 3,
          select: { displayId: true, status: true, job: { select: { displayId: true, title: true } } },
        },
      },
    }),
  ]);
  // In-scope application counts for this page only (relation _count would group all applications).
  const counts = await prisma.application.groupBy({
    by: ["candidateId"],
    where: { AND: [scope, { candidateId: { in: rows.map((c) => c.id) } }] },
    _count: { _all: true },
  });
  const byCandidate = new Map(counts.map((c) => [c.candidateId, c._count._all]));
  const candidates = rows.map((c) => ({ ...c, _count: { applications: byCandidate.get(c.id) ?? 0 } }));
  return { total, candidates };
}
