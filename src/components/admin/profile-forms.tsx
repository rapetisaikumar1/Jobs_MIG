"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import {
  changePasswordSchema,
  profileDetailsSchema,
  type ChangePasswordFormValues,
  type ProfileDetailsFormValues,
} from "@/modules/profile/schemas";
import { changePasswordAction, updateProfileAction } from "@/modules/profile/actions";

type Message = { ok: boolean; text: string } | null;

/** Your own first and last name. The email is shown read-only. */
export function ProfileDetailsForm({ email, defaultValues }: { email: string; defaultValues: ProfileDetailsFormValues }) {
  const [msg, setMsg] = React.useState<Message>(null);
  const form = useForm<ProfileDetailsFormValues>({ resolver: zodResolver(profileDetailsSchema), defaultValues });
  const { register, handleSubmit, formState, setError } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    const result = await updateProfileAction(values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else {
      setMsg({ ok: true, text: result.message ?? "Profile updated." });
      // The action calls revalidatePath, so its response already re-renders the page and sidebar.
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} success={msg?.ok ? msg.text : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" required error={e.firstName?.message}>
          <Input id="firstName" autoComplete="given-name" {...fieldAria("firstName", e.firstName?.message)} {...register("firstName")} />
        </Field>
        <Field id="lastName" label="Last name" required error={e.lastName?.message}>
          <Input id="lastName" autoComplete="family-name" {...fieldAria("lastName", e.lastName?.message)} {...register("lastName")} />
        </Field>
        <Field id="email" label="Email" hint="Contact a Super Admin to change your email." className="sm:col-span-2">
          <Input id="email" value={email} readOnly disabled aria-describedby="email-hint" />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={formState.isSubmitting} disabled={formState.isSubmitting}>Save changes</Button>
      </div>
    </form>
  );
}

const EMPTY_PASSWORDS: ChangePasswordFormValues = { currentPassword: "", password: "", confirmPassword: "" };

/** Change your own password; the current password is required. */
export function ChangePasswordForm({ email }: { email: string }) {
  const [msg, setMsg] = React.useState<Message>(null);
  const form = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY_PASSWORDS });
  const { register, handleSubmit, formState, setError, reset } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    const result = await changePasswordAction(values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else {
      setMsg({ ok: true, text: result.message ?? "Password changed." });
      reset(EMPTY_PASSWORDS);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} success={msg?.ok ? msg.text : null} />
      {/* Lets password managers tie the new password to this account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="currentPassword" label="Current password" required error={e.currentPassword?.message}>
          <Input id="currentPassword" type="password" autoComplete="current-password" {...fieldAria("currentPassword", e.currentPassword?.message)} {...register("currentPassword")} />
        </Field>
        <Field id="password" label="New password" required error={e.password?.message} className="sm:col-start-1" hint="At least 10 characters, including a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" {...fieldAria("password", e.password?.message, true)} {...register("password")} />
        </Field>
        <Field id="confirmPassword" label="Confirm new password" required error={e.confirmPassword?.message}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...fieldAria("confirmPassword", e.confirmPassword?.message)} {...register("confirmPassword")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={formState.isSubmitting} disabled={formState.isSubmitting}>Change password</Button>
      </div>
    </form>
  );
}
