import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { param, type SearchParams } from "@/lib/pagination";
import { getAuthUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

/** Reached from a password-reset or staff-invitation email (session set by /auth/confirm). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  if (!(await getAuthUser())) redirect("/login?error=link");
  const welcome = !!param(params, "welcome");
  return (
    <AuthCard
      title={welcome ? "Welcome to MaverickInnogarage" : "Choose a new password"}
      description={welcome ? "Set a password to finish activating your staff account." : "Enter a new password for your account."}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
