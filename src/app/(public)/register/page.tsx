import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { param, type SearchParams } from "@/lib/pagination";
import { safeNextPath } from "@/modules/auth/redirects";
import { getAuthUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Where to continue after sign-up, e.g. /jobs/MIG-JOB-000123/apply from a shared job link.
  // Only job-portal paths: never the admin portal.
  const rawNext = param(await searchParams, "next");
  const next = rawNext && !rawNext.startsWith("/admin") ? safeNextPath(rawNext, "") || undefined : undefined;
  if (await getAuthUser()) redirect(next ?? "/candidate/dashboard");
  return (
    <AuthCard
      withBenefits
      title="Create your candidate account"
      description="Apply to IT roles across the United States and Canada and track every application in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-foreground underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
    </AuthCard>
  );
}
