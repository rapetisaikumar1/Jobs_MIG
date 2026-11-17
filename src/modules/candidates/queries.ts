import "server-only";
import { prisma } from "@/lib/prisma";

export async function getOwnProfile(candidateId: string) {
  return prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      skills: { include: { skill: true } },
      documents: { where: { status: "ACTIVE", applicationId: null }, orderBy: { createdAt: "desc" } },
    },
  });
}
