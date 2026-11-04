"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import { verifyEmailCodeSchema } from "@/modules/auth/schemas";
import { resendVerificationAction, verifyEmailCodeAction } from "@/modules/auth/actions";

type Values = z.input<typeof verifyEmailCodeSchema>;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Second step of sign-up: the candidate types the code from the verification email.
 * On success the server action signs them in and redirects to their profile.
 */
export function VerifyCodeForm({
  email,
  onBack,
  backLabel = "Use a different email",
  initialCooldown = RESEND_COOLDOWN_SECONDS,
}: {
  email: string;
  onBack?: () => void;
  backLabel?: string;
  /** Seconds before "Resend code" is enabled (0 when no code was just sent). */
  initialCooldown?: number;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(initialCooldown);
  const [resending, setResending] = React.useState(false);
  const form = useForm<Values>({ resolver: zodResolver(verifyEmailCodeSchema), defaultValues: { email, code: "" } });
  const { register, handleSubmit, formState, setError: setFieldError } = form;

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setNotice(null);
    const result = await verifyEmailCodeAction(values);
    // On success the action redirects; we only get here on failure.
    if (result && !result.ok) {
      setError(result.error);
      applyServerErrors(result, setFieldError);
    }
  });

  async function resend() {
    setError(null);
    setNotice(null);
    setResending(true);
    const result = await resendVerificationAction({ email });
    setResending(false);
    if (result.ok) {
      setNotice(result.message ?? "A new code has been sent.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else setError(result.error);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-foreground shadow-xs">
          <MailCheck className="size-4" aria-hidden />
        </span>
        <p className="text-muted-foreground">
          We sent a 6-digit code to <span className="break-all font-medium text-foreground">{email}</span>. Enter it below to finish
          creating your account. Check your spam folder if you don&apos;t see it.
        </p>
      </div>
      <FormAlert error={error} success={notice} />
      <Field id="code" label="Verification code" required error={formState.errors.code?.message}>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={12}
          placeholder="123456"
          className="h-12 text-center font-mono text-xl tracking-[0.4em] placeholder:tracking-[0.4em]"
          aria-invalid={!!formState.errors.code}
          {...register("code")}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? "Verifying…" : "Verify and continue"}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          className="font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {resending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        {onBack && (
          <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground hover:underline">
            {backLabel}
          </button>
        )}
      </div>
    </form>
  );
}
