import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { getAuthUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage() {
  if (await getAuthUser()) redirect("/candidate/dashboard");
  return (
    <AuthCard
      withBenefits
      title="Create your candidate account"
      description="Apply to IT roles across the United States and Canada and track every application in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
