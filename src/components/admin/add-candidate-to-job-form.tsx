"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import { DocumentUploader, type UploadedFile } from "@/components/documents/document-uploader";
import { formatFileSize } from "@/lib/format";
import { addCandidateToJobSchema, type AddCandidateToJobFormValues } from "@/modules/applications/schemas";
import { addCandidateToJobAction } from "@/modules/applications/actions";

export function AddCandidateToJobForm({
  jobId,
  candidateId,
  resumes,
  defaultResumeId,
  staff,
  defaults,
}: {
  jobId: string;
  candidateId: string;
  resumes: { id: string; fileName: string; sizeBytes: number }[];
  defaultResumeId: string | null;
  staff: { id: string; name: string }[];
  defaults: { relevantExperienceYears: string; availability: string; workAuthorizationResponse: string; assignedRecruiterId: string };
}) {
  const router = useRouter();
  // Keep the submit button busy until the destination page has loaded.
  const [navigating, startNavigation] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [upload, setUpload] = React.useState<UploadedFile | null>(null);
  const form = useForm<AddCandidateToJobFormValues>({
    resolver: zodResolver(addCandidateToJobSchema),
    defaultValues: {
      jobId,
      candidateId,
      resumeDocumentId: defaultResumeId ?? resumes[0]?.id ?? "",
      relevantExperienceYears: defaults.relevantExperienceYears,
      relevantExperienceSummary: "",
      availability: defaults.availability,
      workAuthorizationResponse: defaults.workAuthorizationResponse,
      consentBasis: "",
      consentConfirmed: false as unknown as true,
      assignedRecruiterId: defaults.assignedRecruiterId,
      note: "",
    },
  });
  const { register, control, handleSubmit, formState, setValue, watch, setError: setFieldError } = form;
  const e = formState.errors;
  const selected = watch("resumeDocumentId");

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await addCandidateToJobAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerErrors(result, setFieldError);
    } else startNavigation(() => router.push(`/admin/applications/${result.data.displayId}?notice=created`));
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormAlert error={error} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Resume to submit <span className="text-destructive">*</span></legend>
        {resumes.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm">
            <input type="radio" value={r.id} {...register("resumeDocumentId")} />
            {r.fileName} <span className="text-xs text-muted-foreground">{formatFileSize(r.sizeBytes)}{r.id === defaultResumeId ? " · default" : ""}</span>
          </label>
        ))}
        {upload ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value={upload.documentId} {...register("resumeDocumentId")} /> {upload.fileName} (new upload)
          </label>
        ) : null}
        <div className="max-w-md">
          <DocumentUploader
            id="newResume"
            type="RESUME"
            candidateId={candidateId}
            value={null}
            onChange={(file) => {
              if (!file) return;
              setUpload(file);
              setValue("resumeDocumentId", file.documentId);
            }}
          />
        </div>
        {!selected && e.resumeDocumentId && <p className="text-xs text-destructive">{e.resumeDocumentId.message}</p>}
        <p className="text-xs text-muted-foreground">A copy is stored in the application folder, so later profile changes do not affect it.</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="relevantExperienceYears" label="Relevant experience (years)" error={e.relevantExperienceYears?.message}>
          <Input id="relevantExperienceYears" type="number" min={0} step={0.5} {...register("relevantExperienceYears")} />
        </Field>
        <Field id="availability" label="Availability" error={e.availability?.message}>
          <Input id="availability" {...register("availability")} />
        </Field>
        <Field id="workAuthorizationResponse" label="Work authorization" error={e.workAuthorizationResponse?.message}>
          <Input id="workAuthorizationResponse" {...register("workAuthorizationResponse")} />
        </Field>
        <Field id="assignedRecruiterId" label="Assigned recruiter" error={e.assignedRecruiterId?.message}>
          <Select id="assignedRecruiterId" {...register("assignedRecruiterId")}>
            <option value="">Job&apos;s recruiter / me</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field id="relevantExperienceSummary" label="Why this candidate fits" error={e.relevantExperienceSummary?.message}>
        <Textarea id="relevantExperienceSummary" rows={3} {...register("relevantExperienceSummary")} />
      </Field>
      <Field id="consentBasis" label="Consent / representation basis" required error={e.consentBasis?.message} hint="e.g. Candidate confirmed by phone on Nov 3, 2026 that we may submit them for this role.">
        <Textarea id="consentBasis" rows={2} {...register("consentBasis")} />
      </Field>
      <Controller control={control} name="consentConfirmed" render={({ field }) => (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={!!field.value} onChange={(ev) => field.onChange(ev.target.checked)} />
          I confirm the candidate has agreed to be represented by MaverickInnogarage for this role.
        </label>
      )} />
      {e.consentConfirmed && <p className="text-xs text-destructive">{e.consentConfirmed.message}</p>}
      <Field id="note" label="Internal note" error={e.note?.message}>
        <Textarea id="note" rows={2} {...register("note")} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={formState.isSubmitting || navigating} disabled={formState.isSubmitting || navigating}>{formState.isSubmitting || navigating ? "Adding…" : "Add to job"}</Button>
      </div>
    </form>
  );
}
