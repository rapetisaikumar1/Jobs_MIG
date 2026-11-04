"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import {
  roleSchema,
  staffPasswordSchema,
  staffUserCreateSchema,
  staffUserUpdateSchema,
  type RoleFormValues,
  type StaffPasswordFormValues,
  type StaffUserCreateFormValues,
  type StaffUserUpdateFormValues,
} from "@/modules/access-control/schemas";
import {
  createStaffUserAction,
  saveRoleAction,
  setStaffUserPasswordAction,
  updateStaffUserAction,
} from "@/modules/access-control/actions";

type Option = { id: string; name: string; description?: string | null };
type Message = { ok: boolean; text: string } | null;

function RoleChecklist({ roles, register }: { roles: Option[]; register: UseFormRegister<{ roleIds: string[] }> }) {
  return (
    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
      {roles.map((o) => (
        <label key={o.id} className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" value={o.id} {...register("roleIds")} />
          <span>
            {o.name}
            {o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

const PASSWORD_HINT = "At least 10 characters, including a letter and a number.";

/** Create a staff login directly: name, email, initial password and roles. */
export function CreateStaffUserForm({ roles, defaultRoleIds }: { roles: Option[]; defaultRoleIds: string[] }) {
  const router = useRouter();
  const [navigating, startNavigation] = React.useTransition();
  const [msg, setMsg] = React.useState<Message>(null);
  const form = useForm<StaffUserCreateFormValues>({
    resolver: zodResolver(staffUserCreateSchema),
    defaultValues: { email: "", firstName: "", lastName: "", password: "", confirmPassword: "", roleIds: defaultRoleIds },
  });
  const { register, handleSubmit, formState, setError } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    const result = await createStaffUserAction(values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else startNavigation(() => router.push(`/admin/users/${result.data.id}?notice=created`));
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" required error={e.firstName?.message}><Input id="firstName" {...register("firstName")} /></Field>
        <Field id="lastName" label="Last name" required error={e.lastName?.message}><Input id="lastName" {...register("lastName")} /></Field>
        <Field id="email" label="Work email" required error={e.email?.message} hint="The user signs in with this email." className="sm:col-span-2">
          <Input id="email" type="email" autoComplete="off" {...register("email")} />
        </Field>
        <Field id="password" label="Initial password" required error={e.password?.message} hint={PASSWORD_HINT}>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field id="confirmPassword" label="Confirm password" required error={e.confirmPassword?.message}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
        </Field>
      </div>
      <Field id="roleIds" label="Roles" required error={e.roleIds?.message}>
        <RoleChecklist roles={roles} register={register as unknown as UseFormRegister<{ roleIds: string[] }>} />
      </Field>
      <p className="text-xs text-muted-foreground">
        The account is active immediately. Share the initial password with the user securely; they can change it later from “Forgot password”.
      </p>
      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting || navigating}>{formState.isSubmitting || navigating ? "Creating…" : "Create user"}</Button>
      </div>
    </form>
  );
}

/** Edit a staff user's name and roles. */
export function EditStaffUserForm({ userId, email, defaultValues, roles }: { userId: string; email: string; defaultValues: Omit<StaffUserUpdateFormValues, "userId">; roles: Option[] }) {
  const router = useRouter();
  const [msg, setMsg] = React.useState<Message>(null);
  const form = useForm<StaffUserUpdateFormValues>({ resolver: zodResolver(staffUserUpdateSchema), defaultValues: { ...defaultValues, userId } });
  const { register, handleSubmit, formState, setError } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    const result = await updateStaffUserAction(values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else {
      setMsg({ ok: true, text: result.message ?? "Saved." });
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} success={msg?.ok ? msg.text : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" required error={e.firstName?.message}><Input id="firstName" {...register("firstName")} /></Field>
        <Field id="lastName" label="Last name" required error={e.lastName?.message}><Input id="lastName" {...register("lastName")} /></Field>
        <Field id="email" label="Work email" hint="The sign-in email cannot be changed." className="sm:col-span-2">
          <Input id="email" value={email} readOnly disabled />
        </Field>
      </div>
      <Field id="roleIds" label="Roles" required error={e.roleIds?.message}>
        <RoleChecklist roles={roles} register={register as unknown as UseFormRegister<{ roleIds: string[] }>} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>Save changes</Button>
      </div>
    </form>
  );
}

/** Admin sets a new password for a staff user. */
export function SetPasswordForm({ userId }: { userId: string }) {
  const [msg, setMsg] = React.useState<Message>(null);
  const form = useForm<StaffPasswordFormValues>({ resolver: zodResolver(staffPasswordSchema), defaultValues: { userId, password: "", confirmPassword: "" } });
  const { register, handleSubmit, formState, setError, reset } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    const result = await setStaffUserPasswordAction(values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else {
      setMsg({ ok: true, text: result.message ?? "Password updated." });
      reset({ userId, password: "", confirmPassword: "" });
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} success={msg?.ok ? msg.text : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="newPassword" label="New password" error={e.password?.message} hint={PASSWORD_HINT}>
          <Input id="newPassword" type="password" autoComplete="new-password" {...register("password")} />
        </Field>
        <Field id="confirmNewPassword" label="Confirm new password" error={e.confirmPassword?.message}>
          <Input id="confirmNewPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="outline" disabled={formState.isSubmitting}>Set password</Button>
      </div>
    </form>
  );
}

type PermissionGroup = { label: string; permissions: { code: string; description: string }[] };

/** Role editor with permissions grouped by area. */
export function RoleForm({ roleId, defaultValues, groups, readOnly }: { roleId?: string; defaultValues: RoleFormValues; groups: PermissionGroup[]; readOnly?: boolean }) {
  const router = useRouter();
  const [navigating, startNavigation] = React.useTransition();
  const [msg, setMsg] = React.useState<Message>(null);
  const form = useForm<RoleFormValues>({ resolver: zodResolver(roleSchema), defaultValues });
  const { register, handleSubmit, formState, setError, watch, setValue } = form;
  const selected = new Set(watch("permissions") ?? []);

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    const result = await saveRoleAction(roleId ?? null, values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else if (!roleId) startNavigation(() => router.push(`/admin/roles/${result.data.id}?notice=created`));
    else {
      setMsg({ ok: true, text: "Role saved." });
      router.refresh();
    }
  });

  function toggleGroup(group: PermissionGroup, on: boolean) {
    const next = new Set(selected);
    for (const p of group.permissions) {
      if (on) next.add(p.code);
      else next.delete(p.code);
    }
    setValue("permissions", [...next], { shouldDirty: true });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} success={msg?.ok ? msg.text : null} />
      <fieldset disabled={readOnly} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Role name" required error={formState.errors.name?.message}><Input id="name" {...register("name")} /></Field>
          <Field id="description" label="Description" hint="Optional · shown next to the role when assigning it to users" error={formState.errors.description?.message} className="sm:col-span-2">
            <Textarea id="description" rows={2} {...register("description")} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Permissions <span className="font-normal text-muted-foreground">({selected.size} selected)</span></p>
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((group) => {
              const all = group.permissions.every((p) => selected.has(p.code));
              return (
                <div key={group.label} className="rounded-lg border">
                  <label className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-semibold">
                    {group.label}
                    <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      Select all
                      <Checkbox checked={all} onChange={(ev) => toggleGroup(group, ev.target.checked)} aria-label={`Select all ${group.label} permissions`} />
                    </span>
                  </label>
                  <div className="space-y-2 p-3">
                    {group.permissions.map((p) => (
                      <label key={p.code} className="flex items-start gap-2 text-sm">
                        <Checkbox className="mt-0.5" value={p.code} {...register("permissions")} />
                        <span>
                          {p.description}
                          <span className="block font-mono text-[11px] text-muted-foreground">{p.code}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </fieldset>
      {!readOnly && <div className="flex justify-end"><Button type="submit" disabled={formState.isSubmitting || navigating}>{formState.isSubmitting || navigating ? "Saving…" : "Save role"}</Button></div>}
    </form>
  );
}
