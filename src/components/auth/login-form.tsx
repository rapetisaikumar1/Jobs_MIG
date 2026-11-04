"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import { loginSchema } from "@/modules/auth/schemas";
import { loginAction, resendVerificationAction } from "@/modules/auth/actions";
import { VerifyCodeForm } from "@/components/auth/verify-code-form";

type Values = z.input<typeof loginSchema>;

export function LoginForm({ portal, next }: { portal: "candidate" | "staff"; next?: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  // Job portal: an unverified candidate can finish sign-up with the emailed code.
  const [codeEmail, setCodeEmail] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { register, handleSubmit, formState, setError: setFieldError, getValues } = form;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setNotice(null);
    const result = await loginAction(values, portal, next);
    // On success the action redirects; we only get here on failure.
    if (result && !result.ok) {
      setError(result.error);
      applyServerErrors(result, setFieldError);
    }
  });

  const unverified = error?.startsWith("Please verify");

  if (codeEmail) {
    return <VerifyCodeForm email={codeEmail} initialCooldown={0} onBack={() => setCodeEmail(null)} backLabel="Back to sign in" />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={error} success={notice} />
      <Field id="email" label="Email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field id="password" label="Password" error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register("password")} />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground hover:underline">
          Forgot password?
        </Link>
        {unverified && portal === "candidate" && (
          <button
            type="button"
            className="font-medium text-foreground underline"
            onClick={() => {
              setError(null);
              setCodeEmail(getValues("email").trim().toLowerCase());
            }}
          >
            Enter verification code
          </button>
        )}
        {unverified && portal === "staff" && (
          <button
            type="button"
            className="text-muted-foreground underline hover:text-foreground"
            onClick={async () => {
              const result = await resendVerificationAction({ email: getValues("email") });
              setNotice(result.ok ? (result.message ?? null) : null);
              if (!result.ok) setError(result.error);
            }}
          >
            Resend verification email
          </button>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
