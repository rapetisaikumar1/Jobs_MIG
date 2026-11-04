import type { CandidateSkillLevel, JobSkillType, Prisma } from "@prisma/client";
import { cleanList, skillSlug } from "@/lib/format";

/**
 * Upserts standardized skills by slug and returns their ids keyed by slug. Two statements
 * regardless of how many skills (was one upsert per skill): insert the missing ones
 * (existing names are never changed, as before), then read all ids.
 */
export async function ensureSkills(tx: Prisma.TransactionClient, names: string[]): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();
  for (const name of cleanList(names)) {
    const slug = skillSlug(name);
    if (!bySlug.has(slug)) bySlug.set(slug, name);
  }
  if (!bySlug.size) return new Map();
  await tx.skill.createMany({ data: [...bySlug].map(([slug, name]) => ({ slug, name })), skipDuplicates: true });
  const rows = await tx.skill.findMany({ where: { slug: { in: [...bySlug.keys()] } }, select: { id: true, slug: true } });
  return new Map(rows.map((r) => [r.slug, r.id]));
}

/** Replaces a candidate's skills. A skill listed as primary wins over secondary. */
export async function replaceCandidateSkills(
  tx: Prisma.TransactionClient,
  candidateId: string,
  primary: string[],
  secondary: string[],
): Promise<void> {
  const ids = await ensureSkills(tx, [...primary, ...secondary]);
  const levels = new Map<string, CandidateSkillLevel>();
  for (const name of secondary) levels.set(skillSlug(name), "SECONDARY");
  for (const name of primary) levels.set(skillSlug(name), "PRIMARY");

  await tx.candidateSkill.deleteMany({ where: { candidateId } });
  if (levels.size) {
    await tx.candidateSkill.createMany({
      data: [...levels].map(([slug, level]) => ({ candidateId, skillId: ids.get(slug)!, level })),
    });
  }
}

/** Replaces a job's skills. A skill listed as required wins over preferred. */
export async function replaceJobSkills(
  tx: Prisma.TransactionClient,
  jobId: string,
  required: string[],
  preferred: string[],
): Promise<void> {
  const ids = await ensureSkills(tx, [...required, ...preferred]);
  const types = new Map<string, JobSkillType>();
  for (const name of preferred) types.set(skillSlug(name), "PREFERRED");
  for (const name of required) types.set(skillSlug(name), "REQUIRED");

  await tx.jobSkill.deleteMany({ where: { jobId } });
  if (types.size) {
    await tx.jobSkill.createMany({
      data: [...types].map(([slug, type]) => ({ jobId, skillId: ids.get(slug)!, type })),
    });
  }
}

/** Splits loaded skill rows into display lists. */
export function splitSkills<L extends string>(rows: { level?: L; type?: L; skill: { name: string } }[], first: L) {
  const a: string[] = [];
  const b: string[] = [];
  for (const row of rows) ((row.level ?? row.type) === first ? a : b).push(row.skill.name);
  return [a.sort(), b.sort()] as const;
}
