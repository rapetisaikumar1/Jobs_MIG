import Link from "next/link";
import { ArrowRight, FileCheck2, Search, ShieldCheck, UserRoundPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { JobCard, JobTile } from "@/components/jobs/job-card";
import { HeroSearch } from "@/components/jobs/hero-search";
import { siteConfig } from "@/config/site";
import { formatLocation } from "@/config/locations";
import { formatDate } from "@/lib/format";
import { getViewerTimeZone } from "@/lib/request";
import { countOpenJobs, listHomepageJobs } from "@/modules/jobs/queries";

export const dynamic = "force-dynamic";

const POPULAR = ["Java", "Data Engineer", "DevOps", "React", "Python", ".NET", "QA Automation"];

export default async function HomePage() {
  const [{ featured, recent }, timeZone, total] = await Promise.all([listHomepageJobs(), getViewerTimeZone(), countOpenJobs()]);
  const featuredIds = new Set(featured.map((j) => j.id));
  const recentOnly = recent.filter((j) => !featuredIds.has(j.id));

  return (
    <>
      <section className="relative z-10 border-b bg-surface">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
              <span className="inline-block size-1.5 rounded-full bg-brand" aria-hidden /> {total} open {total === 1 ? "role" : "roles"} across the US &amp; Canada
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Find your next technology role with <span className="whitespace-nowrap">{siteConfig.name}</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              We partner with leading employers to fill software, data, cloud and infrastructure roles — full-time and contract, remote and on-site.
            </p>

            <HeroSearch />

            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Popular:</span>
              {POPULAR.map((q) => (
                <Link key={q} href={`/jobs?q=${encodeURIComponent(q)}`} className="rounded-full border bg-background px-3 py-1 text-xs font-medium transition-colors hover:border-foreground/30 hover:bg-muted">
                  {q}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="rounded-2xl border bg-background p-5 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Latest openings</p>
                <Link href="/jobs" className="text-xs font-medium text-muted-foreground hover:text-foreground">View all</Link>
              </div>
              <ul className="divide-y">
                {recent.slice(0, 4).map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.displayId}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/60">
                      <JobTile />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{job.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatLocation(job.city, job.state, job.country)} · {formatDate(job.publishedAt, timeZone)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {!recent.length && <li className="py-6 text-center text-sm text-muted-foreground">New roles are posted regularly.</li>}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Featured opportunities</h2>
              <p className="mt-1 text-sm text-muted-foreground">Priority roles our recruiters are actively hiring for.</p>
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            {featured.map((job) => <JobCard key={job.id} job={job} timeZone={timeZone} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Recently posted jobs</h2>
            <p className="mt-1 text-sm text-muted-foreground">The newest roles across the United States and Canada.</p>
          </div>
          <Link href="/jobs" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline">
            View all jobs <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {recentOnly.length || featured.length ? (
          <div className="mt-5 space-y-2.5">
            {(recentOnly.length ? recentOnly : featured).map((job) => <JobCard key={job.id} job={job} timeZone={timeZone} />)}
          </div>
        ) : (
          <EmptyState className="mt-5" title="No open positions right now" description="New roles are posted regularly. Create an account so you're ready to apply." />
        )}
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: Search, title: "Search and apply", text: "Browse open roles and apply in minutes using your saved profile and resume." },
            { icon: FileCheck2, title: "Track every application", text: "See where each application stands from your candidate dashboard." },
            { icon: ShieldCheck, title: "Your data, protected", text: "Resumes are stored privately and shared only for roles you apply to." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-surface"><Icon className="size-5" aria-hidden /></span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4 pb-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-primary px-8 py-10 text-primary-foreground sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Let recruiters find you</h2>
            <p className="mt-1 max-w-xl text-sm text-primary-foreground/75">
              Create a free profile with your skills and resume. Our team matches candidates to new roles every day.
            </p>
          </div>
          <Link href="/register" className={buttonVariants({ variant: "outline", size: "lg", className: "border-transparent text-foreground" })}>
            <UserRoundPlus aria-hidden /> Create your profile
          </Link>
        </div>
      </section>
    </>
  );
}
