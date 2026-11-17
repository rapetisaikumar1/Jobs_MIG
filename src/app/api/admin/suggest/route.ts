import { stripControlChars } from "@/lib/utils";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { JOB_STATUS_LABELS } from "@/config/options";
import { getStaffContext } from "@/modules/access-control/context";
import { jobScopeWhere } from "@/modules/access-control/scope";

const ci = "insensitive" as const;

/** Type-ahead for the admin top-bar search: in-scope jobs by title, Job ID or city. */
export async function GET(request: NextRequest) {
  const ctx = await getStaffContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  const q = stripControlChars(request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ jobs: [] });

  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        jobScopeWhere(ctx),
        { OR: [{ title: { contains: q, mode: ci } }, { displayId: { contains: q, mode: ci } }, { city: { contains: q, mode: ci } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { displayId: true, title: true, status: true, city: true, state: true },
  });

  return NextResponse.json(
    { jobs: jobs.map((j) => ({ displayId: j.displayId, title: j.title, detail: `${j.displayId} · ${j.city}, ${j.state} · ${JOB_STATUS_LABELS[j.status]}` })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
