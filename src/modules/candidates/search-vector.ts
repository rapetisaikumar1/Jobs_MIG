import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Rebuilds the full-text search document for a candidate (names and titles weigh
 * most, then skills, background, and locations). Call after any profile or skill change.
 */
export async function refreshCandidateSearchVector(candidateId: string, db: Db = prisma): Promise<void> {
  await db.$executeRaw`
    UPDATE candidate_profiles cp SET search_vector =
      setweight(to_tsvector('english',
        coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '') || ' ' ||
        coalesce(cp.professional_title, '') || ' ' || coalesce(cp.current_title, '') || ' ' ||
        array_to_string(cp.preferred_job_titles, ' ')), 'A') ||
      setweight(to_tsvector('english', coalesce((
        SELECT string_agg(s.name, ' ') FROM candidate_skills cs
        JOIN skills s ON s.id = cs.skill_id WHERE cs.candidate_id = cp.id), '')), 'A') ||
      setweight(to_tsvector('english',
        coalesce(cp.current_employer, '') || ' ' || coalesce(cp.education, '') || ' ' ||
        array_to_string(cp.certifications, ' ')), 'B') ||
      setweight(to_tsvector('english',
        coalesce(cp.city, '') || ' ' || coalesce(cp.state, '') || ' ' ||
        array_to_string(cp.preferred_locations, ' ')), 'C')
    WHERE cp.id = ${candidateId}::uuid`;
}
