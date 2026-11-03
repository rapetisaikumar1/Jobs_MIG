"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { forgotPasswordSchema, resetPasswordSchema } from "@/modules/auth/schemas";
import { forgotPasswordAction, resetPasswordAction } from "@/modules/auth/actions";

export function ForgotPasswordForm() {
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    const result = await forgotPasswordAction(values);
    setMessage(result.ok ? { ok: true, text: result.message ?? "Check your email." } : { ok: false, text: result.error });
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={message && !message.ok ? message.text : null} success={message?.ok ? message.text : null} />
      <Field id="email" label="Email" error={form.formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.input<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const e = form.formState.errors;
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = await resetPasswordAction(values);
    if (result && !result.ok) setError(result.error);
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={error} />
      <Field id="password" label="New password" error={e.password?.message} hint="At least 10 characters, including a letter and a number.">
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={e.confirmPassword?.message}>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        Save password
      </Button>
    </form>
  );
}
