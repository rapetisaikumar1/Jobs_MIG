import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { param, type SearchParams } from "@/lib/pagination";
import { getAppUser, getAuthUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

/** Staff password reset (session set by /auth/confirm from the recovery email). */
export default async function AdminResetPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const authUser = await getAuthUser();
  if (!authUser) redirect("/admin/login?expired=1");
  // Candidate sessions belong on the job portal's own reset page.
  if ((await getAppUser(authUser.id))?.type !== "STAFF") redirect("/reset-password");
  const welcome = !!param(params, "welcome");
  return (
    <AuthCard
      title={welcome ? "Welcome to MaverickInnogarage" : "Choose a new password"}
      description={welcome ? "Set a password to finish activating your staff account." : "Enter a new password for your staff account."}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
