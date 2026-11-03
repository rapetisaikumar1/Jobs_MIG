import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { param, type SearchParams } from "@/lib/pagination";
import { getAuthUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  if (await getAuthUser()) redirect("/candidate/dashboard");
  const notice = param(params, "expired")
    ? "Your session has expired. Please sign in again."
    : param(params, "inactive")
      ? "This account is not active on the job portal."
      : param(params, "error") === "link"
        ? "That link is invalid or has expired. Please request a new one."
        : null;

  return (
    <AuthCard
      withBenefits
      title="Sign in to your account"
      description="Track your applications and apply to jobs faster."
      footer={
        <>
          New to MaverickInnogarage?{" "}
          <Link href="/register" className="font-medium text-foreground underline">
            Create an account
          </Link>
        </>
      }
    >
      {notice && <Alert variant="neutral" className="mb-4">{notice}</Alert>}
      <LoginForm portal="candidate" next={param(params, "next")} />
    </AuthCard>
  );
}
