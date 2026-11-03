import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { param, type SearchParams } from "@/lib/pagination";
import { getStaffContext } from "@/modules/access-control/context";

export const metadata: Metadata = { title: "Staff sign in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  if (await getStaffContext()) redirect("/admin/jobs");
  return (
    <AuthCard title="Staff sign in" description="Authorized MaverickInnogarage staff only.">
      {param(params, "expired") && <Alert variant="neutral" className="mb-4">Your session has expired. Please sign in again.</Alert>}
      <LoginForm portal="staff" next={param(params, "next")} />
    </AuthCard>
  );
}
