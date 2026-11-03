"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import {
  groupSchema,
  roleSchema,
  staffUserCreateSchema,
  type GroupFormValues,
  type RoleFormValues,
  type StaffUserCreateFormValues,
} from "@/modules/access-control/schemas";
import { createStaffUserAction, saveGroupAction, saveRoleAction, updateStaffUserAction } from "@/modules/access-control/actions";

type Option = { id: string; name: string; description?: string | null };

function CheckList({ options, name, register }: { options: Option[]; name: string; register: (n: never) => object }) {
  return (
    <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
      {options.length ? options.map((o) => (
        <label key={o.id} className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" value={o.id} {...register(name as never)} />
          <span>{o.name}{o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}</span>
        </label>
      )) : <span className="text-xs text-muted-foreground">None available</span>}
    </div>
  );
}

export function StaffUserForm({
  userId,
  defaultValues,
  roles,
  groups,
}: {
  userId?: string;
  defaultValues: StaffUserCreateFormValues;
  roles: Option[];
  groups: Option[];
}) {
  const router = useRouter();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  // Same client-side rules for both modes; on update the (read-only) email is ignored by the server.
  const form = useForm<StaffUserCreateFormValues>({ resolver: zodResolver(staffUserCreateSchema), defaultValues });
  const { register, handleSubmit, formState, setError } = form;
  const e = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    const result = userId ? await updateStaffUserAction({ ...values, userId }) : await createStaffUserAction(values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else if (!userId && result.data && "id" in result.data) router.push(`/admin/users/${result.data.id}?notice=invited`);
    else {
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
        <Field id="email" label="Work email" required error={e.email?.message} hint={userId ? "Email is the sign-in and cannot be changed here." : "An invitation is sent to this address."} className="sm:col-span-2">
          <Input id="email" type="email" readOnly={!!userId} {...register("email")} />
        </Field>
      </div>
      <Field id="roleIds" label="Roles" required error={e.roleIds?.message}><CheckList options={roles} name="roleIds" register={register as never} /></Field>
      <Field id="groupIds" label="Groups" error={e.groupIds?.message}><CheckList options={groups} name="groupIds" register={register as never} /></Field>
      <div className="flex justify-end"><Button type="submit" disabled={formState.isSubmitting}>{userId ? "Save changes" : "Send invitation"}</Button></div>
    </form>
  );
}

export function RoleForm({ roleId, defaultValues, permissions, readOnly }: { roleId?: string; defaultValues: RoleFormValues; permissions: Option[]; readOnly?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm<RoleFormValues>({ resolver: zodResolver(roleSchema), defaultValues });
  const { register, handleSubmit, formState, setError } = form;
  const onSubmit = handleSubmit(async (values) => {
    const result = await saveRoleAction(roleId ?? null, values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else if (!roleId) router.push(`/admin/roles/${result.data.id}`);
    else {
      setMsg({ ok: true, text: "Role saved." });
      router.refresh();
    }
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} success={msg?.ok ? msg.text : null} />
      <fieldset disabled={readOnly} className="space-y-4">
        <Field id="name" label="Role name" required error={formState.errors.name?.message}><Input id="name" {...register("name")} /></Field>
        <Field id="description" label="Description" error={formState.errors.description?.message}><Textarea id="description" rows={2} {...register("description")} /></Field>
        <Field id="permissions" label="Permissions"><CheckList options={permissions} name="permissions" register={register as never} /></Field>
      </fieldset>
      {!readOnly && <div className="flex justify-end"><Button type="submit" disabled={formState.isSubmitting}>Save role</Button></div>}
    </form>
  );
}

export function GroupForm({ groupId, defaultValues, staff }: { groupId?: string; defaultValues: GroupFormValues; staff: Option[] }) {
  const router = useRouter();
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm<GroupFormValues>({ resolver: zodResolver(groupSchema), defaultValues });
  const { register, handleSubmit, formState, setError } = form;
  const onSubmit = handleSubmit(async (values) => {
    const result = await saveGroupAction(groupId ?? null, values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else if (!groupId) router.push(`/admin/roles/groups/${result.data.id}`);
    else {
      setMsg({ ok: true, text: "Group saved." });
      router.refresh();
    }
  });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} success={msg?.ok ? msg.text : null} />
      <Field id="name" label="Group name" required error={formState.errors.name?.message}><Input id="name" placeholder="Canada Recruitment Team" {...register("name")} /></Field>
      <Field id="description" label="Description" error={formState.errors.description?.message}><Textarea id="description" rows={2} {...register("description")} /></Field>
      <Field id="memberIds" label="Members" hint="Members can work on jobs assigned to this group."><CheckList options={staff} name="memberIds" register={register as never} /></Field>
      <div className="flex justify-end"><Button type="submit" disabled={formState.isSubmitting}>Save group</Button></div>
    </form>
  );
}
