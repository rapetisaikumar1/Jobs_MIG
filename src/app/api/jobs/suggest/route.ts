import { NextResponse, type NextRequest } from "next/server";
import { EMPLOYMENT_TYPE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import { listPublicJobs } from "@/modules/jobs/queries";

/** Search-as-you-type suggestions for the public job search (open, published jobs only). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim().slice(0, 100) || undefined;
  const location = params.get("location")?.trim().slice(0, 100) || undefined;
  const country = params.get("country");
  if (!q && !location) return NextResponse.json({ total: 0, jobs: [] });

  const { total, jobs } = await listPublicJobs(
    { q, location, country: country === "US" || country === "CA" ? country : undefined },
    1,
    6,
  );
  return NextResponse.json(
    {
      total,
      jobs: jobs.map((job) => ({
        displayId: job.displayId,
        title: job.title,
        location: formatLocation(job.city, job.state, job.country),
        meta: `${WORK_ARRANGEMENT_LABELS[job.workArrangement]} · ${EMPLOYMENT_TYPE_LABELS[job.employmentType]}`,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
