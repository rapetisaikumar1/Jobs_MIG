"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import { clientSchema, type ClientFormValues } from "@/modules/clients/schemas";
import { createClientAction, updateClientAction } from "@/modules/clients/actions";

type Message = { ok: boolean; text: string } | null;

/** Create a client (then opens it) or edit one in place. */
export function ClientForm({ clientId, defaultValues }: { clientId?: string; defaultValues: ClientFormValues }) {
  const router = useRouter();
  const [navigating, startNavigation] = React.useTransition();
  const [msg, setMsg] = React.useState<Message>(null);
  const form = useForm<ClientFormValues>({ resolver: zodResolver(clientSchema), defaultValues });
  const { register, handleSubmit, formState, setError } = form;
  const e = formState.errors;
  const busy = formState.isSubmitting || navigating;

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    if (!clientId) {
      const result = await createClientAction(values);
      if (!result.ok) {
        setMsg({ ok: false, text: result.error });
        applyServerErrors(result, setError);
      } else startNavigation(() => router.push(`/admin/clients/${result.data.id}?notice=created`));
      return;
    }
    const result = await updateClientAction(clientId, values);
    if (!result.ok) {
      setMsg({ ok: false, text: result.error });
      applyServerErrors(result, setError);
    } else {
      setMsg({ ok: true, text: result.message ?? "Client updated." });
      // The action calls revalidatePath, so its response already re-renders this page.
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormAlert error={msg && !msg.ok ? msg.text : null} success={msg?.ok ? msg.text : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Client name" required error={e.name?.message} className="sm:col-span-2">
          <Input id="name" autoComplete="organization" {...fieldAria("name", e.name?.message)} {...register("name")} />
        </Field>
        <Field id="contactName" label="Contact name" error={e.contactName?.message}>
          <Input id="contactName" autoComplete="off" {...fieldAria("contactName", e.contactName?.message)} {...register("contactName")} />
        </Field>
        <Field id="contactEmail" label="Contact email" error={e.contactEmail?.message}>
          <Input id="contactEmail" type="email" autoComplete="off" {...fieldAria("contactEmail", e.contactEmail?.message)} {...register("contactEmail")} />
        </Field>
        <Field id="contactPhone" label="Contact phone" error={e.contactPhone?.message} hint="e.g. (416) 555-0100 or +44 20 7946 0958">
          <Input id="contactPhone" type="tel" autoComplete="off" {...fieldAria("contactPhone", e.contactPhone?.message, true)} {...register("contactPhone")} />
        </Field>
        <Field id="website" label="Website" error={e.website?.message} hint="Starting with https://">
          <Input id="website" type="url" placeholder="https://" autoComplete="off" {...fieldAria("website", e.website?.message, true)} {...register("website")} />
        </Field>
        <Field id="notes" label="Notes" error={e.notes?.message} hint="Internal only · never shown to candidates" className="sm:col-span-2">
          <Textarea id="notes" rows={4} {...fieldAria("notes", e.notes?.message, true)} {...register("notes")} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        {!clientId && <Link href="/admin/clients" className={buttonVariants({ variant: "outline" })}>Cancel</Link>}
        <Button type="submit" loading={busy} disabled={busy}>
          {clientId ? "Save changes" : busy ? "Creating…" : "Create client"}
        </Button>
      </div>
    </form>
  );
}
