import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we'll send you a secure link to choose a new password."
      footer={<Link href="/login" className="underline">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
