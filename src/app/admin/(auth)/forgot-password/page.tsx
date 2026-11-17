import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Staff password reset" };

/** Staff password reset request, kept inside the admin portal. */
export default function AdminForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your staff email and we'll send you a secure link to choose a new password."
      footer={<Link href="/admin/login" className="underline">Back to staff sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
