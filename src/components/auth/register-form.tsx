"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { VerifyCodeForm } from "@/components/auth/verify-code-form";
import { COUNTRY_LABELS, toOptions } from "@/config/options";
import { registerSchema } from "@/modules/auth/schemas";
import { registerAction } from "@/modules/auth/actions";

type Values = z.input<typeof registerSchema>;

export function RegisterForm() {
  const [error, setError] = React.useState<string | null>(null);
  // After the form is submitted: the email address waiting for its verification code.
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", country: "US", password: "", confirmPassword: "" },
  });
  const { register, handleSubmit, formState, setError: setFieldError } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await registerAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerErrors(result, setFieldError);
    } else setPendingEmail(values.email.trim().toLowerCase());
  });

  if (pendingEmail) return <VerifyCodeForm email={pendingEmail} onBack={() => setPendingEmail(null)} />;

  return (
    <>
      <GoogleButton label="Sign up with Google" />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        By continuing with Google you agree to our{" "}
        <Link href="/privacy" target="_blank" className="underline">privacy notice</Link>.
      </p>
      <AuthDivider label="or sign up with email" />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormAlert error={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label="First name" required error={e.firstName?.message}>
            <Input id="firstName" autoComplete="given-name" aria-invalid={!!e.firstName} {...register("firstName")} />
          </Field>
          <Field id="lastName" label="Last name" required error={e.lastName?.message}>
            <Input id="lastName" autoComplete="family-name" aria-invalid={!!e.lastName} {...register("lastName")} />
          </Field>
        </div>
        <Field id="email" label="Email address" required error={e.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!e.email} {...register("email")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="phone" label="Phone number" required error={e.phone?.message} hint="US/Canada: (416) 555-0100">
            <Input id="phone" type="tel" autoComplete="tel" aria-invalid={!!e.phone} {...register("phone")} />
          </Field>
          <Field id="country" label="Country" required error={e.country?.message}>
            <Select id="country" autoComplete="country" {...register("country")}>
              {toOptions(COUNTRY_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="password" label="Password" required error={e.password?.message} hint="At least 10 characters, including a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!e.password} {...register("password")} />
        </Field>
        <Field id="confirmPassword" label="Confirm password" required error={e.confirmPassword?.message}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!e.confirmPassword} {...register("confirmPassword")} />
        </Field>
        <div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" {...register("acceptPrivacy")} />
            <span>
              I have read the{" "}
              <Link href="/privacy" target="_blank" className="underline">
                privacy notice
              </Link>{" "}
              and agree that MaverickInnogarage may use my information to consider me for job opportunities.
            </span>
          </label>
          {e.acceptPrivacy && <p className="mt-1 text-xs text-destructive">{e.acceptPrivacy.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </>
  );
}
