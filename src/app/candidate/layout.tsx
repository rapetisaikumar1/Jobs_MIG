import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/shared/avatar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CandidateNav } from "@/components/layout/candidate-nav";
import { requireCandidate } from "@/modules/auth/session";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireCandidate();
  const name = `${profile.firstName} ${profile.lastName}`;
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <SiteHeader />
      <div className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 pt-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={name} size="lg" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Welcome back, {profile.firstName}</h1>
                <p className="text-sm text-muted-foreground">{profile.email} · Candidate ID {profile.displayId}</p>
              </div>
            </div>
            <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
              <Search aria-hidden /> Find jobs
            </Link>
          </div>
          <div className="mt-6">
            <CandidateNav />
          </div>
        </div>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
