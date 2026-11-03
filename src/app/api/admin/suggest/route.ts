import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatLocation } from "@/config/locations";
import { JOB_STATUS_LABELS } from "@/config/options";
import { getStaffContext } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { jobScopeWhere } from "@/modules/access-control/scope";
import { quickCandidateWhere } from "@/modules/candidates/queries";

const ci = "insensitive" as const;

/** Type-ahead for the admin top-bar search: candidates (by name, email, phone, ID, title, skill) and in-scope jobs. */
export async function GET(request: NextRequest) {
  const ctx = await getStaffContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
  if (!q) return NextResponse.json({ candidates: [], jobs: [] });

  const candidateWhere: Prisma.CandidateProfileWhereInput = {
    OR: [
      quickCandidateWhere(q),
      { currentTitle: { contains: q, mode: ci } },
      { professionalTitle: { contains: q, mode: ci } },
      { skills: { some: { skill: { name: { contains: q, mode: ci } } } } },
    ],
  };
  const [candidates, jobs] = await Promise.all([
    ctx.can(PERMISSIONS.CANDIDATE_VIEW)
      ? prisma.candidateProfile.findMany({
          where: candidateWhere,
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { displayId: true, firstName: true, lastName: true, currentTitle: true, professionalTitle: true, city: true, state: true, country: true },
        })
      : [],
    prisma.job.findMany({
      where: {
        AND: [
          jobScopeWhere(ctx),
          { OR: [{ title: { contains: q, mode: ci } }, { displayId: { contains: q, mode: ci } }, { city: { contains: q, mode: ci } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { displayId: true, title: true, status: true, city: true, state: true },
    }),
  ]);

  return NextResponse.json(
    {
      candidates: candidates.map((c) => ({
        displayId: c.displayId,
        name: `${c.firstName} ${c.lastName}`,
        detail: [c.currentTitle ?? c.professionalTitle, formatLocation(c.city, c.state, c.country)].filter(Boolean).join(" · "),
      })),
      jobs: jobs.map((j) => ({ displayId: j.displayId, title: j.title, detail: `${j.displayId} · ${j.city}, ${j.state} · ${JOB_STATUS_LABELS[j.status]}` })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
