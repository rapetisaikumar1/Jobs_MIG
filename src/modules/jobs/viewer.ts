import "server-only";
import { prisma } from "@/lib/prisma";
import { getAuthUser, getCandidateContext } from "@/modules/auth/session";

/** Job IDs the signed-in candidate (if any) has already applied to. */
export async function getAppliedJobIds(): Promise<Set<string>> {
  if (!(await getAuthUser())) return new Set();
  const ctx = await getCandidateContext();
  if (!ctx) return new Set();
  const rows = await prisma.application.findMany({ where: { candidateId: ctx.profile.id }, select: { jobId: true } });
  return new Set(rows.map((r) => r.jobId));
}
