"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ApplicationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from "@/config/options";
import {
  addApplicationNoteAction,
  assignRecruiterAction,
  updateApplicationStatusAction,
} from "@/modules/applications/actions";

function useResult() {
  const router = useRouter();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, onOk?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      setMessage(result.ok ? { ok: true, text: result.message ?? "Saved." } : { ok: false, text: result.error ?? "Failed." });
      if (result.ok) {
        onOk?.();
        router.refresh();
      }
    });
  return { message, pending, run };
}

export function StatusUpdateForm({ applicationId, status }: { applicationId: string; status: ApplicationStatus }) {
  const [next, setNext] = React.useState<ApplicationStatus>(status);
  const [note, setNote] = React.useState("");
  const { message, pending, run } = useResult();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateApplicationStatusAction({ applicationId, status: next, note }), () => setNote(""));
      }}
    >
      <FormAlert error={message && !message.ok ? message.text : null} success={message?.ok ? message.text : null} />
      <Field id="status" label="Status">
        <Select id="status" value={next} onChange={(e) => setNext(e.target.value as ApplicationStatus)}>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>)}
        </Select>
      </Field>
      <Field id="statusNote" label="Reason / note" hint="Optional · kept in the status history">
        <Input id="statusNote" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending || next === status} className="w-full">Update status</Button>
    </form>
  );
}

export function AssignRecruiterForm({ applicationId, current, staff }: { applicationId: string; current: string; staff: { id: string; name: string }[] }) {
  const [value, setValue] = React.useState(current);
  const { message, pending, run } = useResult();
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => assignRecruiterAction({ applicationId, assignedRecruiterId: value })); }}>
      <Field id="recruiter" label="Assigned recruiter">
        <div className="flex gap-2">
          <Select id="recruiter" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button type="submit" variant="outline" disabled={pending || value === current}>Save</Button>
        </div>
      </Field>
      {message && <p className={message.ok ? "text-xs text-success" : "text-xs text-destructive"}>{message.text}</p>}
    </form>
  );
}

export function NoteForm({ applicationId }: { applicationId: string }) {
  const [body, setBody] = React.useState("");
  const { message, pending, run } = useResult();
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => addApplicationNoteAction({ applicationId, body }), () => setBody("")); }}>
      <Textarea rows={3} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} placeholder="Add an internal note (never visible to the candidate)" aria-label="Internal note" />
      <div className="flex items-center justify-between gap-2">
        {message ? <span className={message.ok ? "text-xs text-success" : "text-xs text-destructive"}>{message.text}</span> : <span />}
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>Add note</Button>
      </div>
    </form>
  );
}
