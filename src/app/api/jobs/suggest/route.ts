import { NextResponse, type NextRequest } from "next/server";
import { EMPLOYMENT_TYPE_LABELS, WORK_ARRANGEMENT_LABELS } from "@/config/options";
import { formatLocation } from "@/config/locations";
import { suggestPublicJobs } from "@/modules/jobs/queries";
import { allowRequest } from "@/lib/memory-rate-limit";

/** Search-as-you-type suggestions for the public job search (open, published jobs only). */
export async function GET(request: NextRequest) {
  // Public, unauthenticated and called per keystroke: cap per client address (in memory, no DB trip).
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (!allowRequest(`jobs-suggest:${ip}`, 240, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim().slice(0, 100) || undefined;
  const location = params.get("location")?.trim().slice(0, 100) || undefined;
  const country = params.get("country");
  if (!q && !location) return NextResponse.json({ total: 0, jobs: [] });

  const { total, jobs } = await suggestPublicJobs(
    { q, location, country: country === "US" || country === "CA" ? country : undefined },
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
