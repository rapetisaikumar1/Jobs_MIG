"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Field, FormSection } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors, errorMessage } from "@/components/forms/form-utils";
import { RegionSelect } from "@/components/forms/region-select";
import { TagInput } from "@/components/forms/tag-input";
import {
  COMPENSATION_TYPE_LABELS,
  CURRENCY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  toOptions,
} from "@/config/options";
import { jobSchema, type JobFormValues } from "@/modules/jobs/schemas";
import { createJobAction, updateJobAction } from "@/modules/jobs/actions";

type Option = { id: string; name: string; disabled?: boolean };

export function JobForm({
  jobId,
  defaultValues,
  staff,
  skillSuggestions,
  meta,
}: {
  jobId?: string;
  defaultValues: JobFormValues;
  staff: Option[];
  skillSuggestions: string[];
  meta?: { displayId: string; createdBy: string; createdAt: string; publishedAt: string; status: string };
}) {
  const router = useRouter();
  // Keep the submit button busy until the destination page has loaded.
  const [navigating, startNavigation] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<JobFormValues>({ resolver: zodResolver(jobSchema), defaultValues });
  const { register, control, watch, handleSubmit, formState, setError: setFieldError, setValue } = form;
  const e = formState.errors;
  const country = watch("country");

  // Selects also get defaultValue so the server-rendered choice matches what will be saved.
  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = jobId ? await updateJobAction(jobId, values) : await createJobAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerErrors(result, setFieldError);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else startNavigation(() => router.push(`/admin/jobs/${result.data.displayId}?notice=${jobId ? "updated" : "created"}`));
  });

  const options = (items: { value: string; label: string }[]) => items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>);

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <FormAlert error={error} />

      <FormSection title="Basic information" description={meta ? `Job ID ${meta.displayId}` : "The Job ID and case file are created automatically."}>
        <Field id="title" label="Job title" required error={e.title?.message} className="sm:col-span-2">
          <Input id="title" placeholder="Senior Java Developer" {...register("title")} />
        </Field>
        <Field id="description" label="Job description" required error={e.description?.message} className="sm:col-span-2">
          <Textarea id="description" rows={8} {...register("description")} />
        </Field>
        <Field id="responsibilities" label="Responsibilities" error={e.responsibilities?.message} hint="One per line" className="sm:col-span-2">
          <Textarea id="responsibilities" rows={6} {...register("responsibilities")} />
        </Field>
        <Field id="requiredSkills" label="Required skills" required error={errorMessage(e as Record<string, unknown>, "requiredSkills")} className="sm:col-span-2">
          <Controller control={control} name="requiredSkills" render={({ field }) => (
            <TagInput id="requiredSkills" value={field.value ?? []} onChange={field.onChange} suggestions={skillSuggestions} invalid={!!e.requiredSkills} />
          )} />
        </Field>
        <Field id="preferredSkills" label="Preferred skills" error={errorMessage(e as Record<string, unknown>, "preferredSkills")} className="sm:col-span-2">
          <Controller control={control} name="preferredSkills" render={({ field }) => (
            <TagInput id="preferredSkills" value={field.value ?? []} onChange={field.onChange} suggestions={skillSuggestions} />
          )} />
        </Field>
        <Field id="minExperience" label="Minimum experience (years)" error={e.minExperience?.message}>
          <Input id="minExperience" type="number" min={0} max={50} {...register("minExperience")} />
        </Field>
        <Field id="maxExperience" label="Maximum experience (years)" error={e.maxExperience?.message}>
          <Input id="maxExperience" type="number" min={0} max={50} {...register("maxExperience")} />
        </Field>
        <Field id="education" label="Education requirements" error={e.education?.message} className="sm:col-span-2">
          <Input id="education" placeholder="Bachelor's degree in Computer Science or equivalent" {...register("education")} />
        </Field>
      </FormSection>

      <FormSection title="Employment details">
        <Field id="country" label="Country" required error={e.country?.message}>
          <Select id="country" defaultValue={defaultValues.country} {...register("country", { onChange: () => setValue("state", "") })}>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </Select>
        </Field>
        <Field id="state" label="State / Province" required error={e.state?.message}>
          <RegionSelect id="state" defaultValue={defaultValues.state} country={country} invalid={!!e.state} {...register("state")} />
        </Field>
        <Field id="city" label="City" required error={e.city?.message}>
          <Input id="city" {...register("city")} />
        </Field>
        <Field id="workArrangement" label="Work arrangement" required error={e.workArrangement?.message}>
          <Select id="workArrangement" defaultValue={defaultValues.workArrangement} {...register("workArrangement")}>{options(toOptions(WORK_ARRANGEMENT_LABELS))}</Select>
        </Field>
        <Field id="employmentType" label="Employment type" required error={e.employmentType?.message}>
          <Select id="employmentType" defaultValue={defaultValues.employmentType} {...register("employmentType")}>{options(toOptions(EMPLOYMENT_TYPE_LABELS))}</Select>
        </Field>
        <Field id="compensationType" label="Pay type" required error={e.compensationType?.message}>
          <Select id="compensationType" defaultValue={defaultValues.compensationType} {...register("compensationType")}>{options(toOptions(COMPENSATION_TYPE_LABELS))}</Select>
        </Field>
        <Field id="compensationMin" label="Salary / rate minimum" error={e.compensationMin?.message}>
          <Input id="compensationMin" type="number" min={0} step="any" {...register("compensationMin")} />
        </Field>
        <Field id="compensationMax" label="Salary / rate maximum" error={e.compensationMax?.message}>
          <Input id="compensationMax" type="number" min={0} step="any" {...register("compensationMax")} />
        </Field>
        <Field id="currency" label="Currency" required error={e.currency?.message}>
          <Select id="currency" defaultValue={defaultValues.currency} {...register("currency")}>{options(toOptions(CURRENCY_LABELS))}</Select>
        </Field>
        <Field id="applicationDeadline" label="Application deadline" error={e.applicationDeadline?.message} hint="Inclusive. Leave empty for open until filled.">
          <Input id="applicationDeadline" type="date" {...register("applicationDeadline")} />
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" {...register("salaryPublic")} />
            <span>Show salary / rate on the public job portal<span className="block text-xs text-muted-foreground">Only when approved for public display.</span></span>
          </label>
          {e.salaryPublic && <p className="mt-1 text-xs text-destructive">{e.salaryPublic.message}</p>}
        </div>
      </FormSection>

      <FormSection title="Internal information" description="Never shown on the public portal.">
        <Field id="assignedRecruiterId" label="Assigned recruiter" hint="Recruiters can see jobs they created or are assigned to." error={e.assignedRecruiterId?.message}>
          <Select id="assignedRecruiterId" defaultValue={(defaultValues.assignedRecruiterId as string | undefined) ?? ""} {...register("assignedRecruiterId")}>
            <option value="">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field id="internalNotes" label="Internal notes" error={e.internalNotes?.message} className="sm:col-span-2">
          <Textarea id="internalNotes" rows={3} {...register("internalNotes")} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <Checkbox {...register("isFeatured")} /> Feature this job on the homepage
        </label>
        {meta && (
          <dl className="grid gap-2 text-xs text-muted-foreground sm:col-span-2 sm:grid-cols-2">
            <div>Status: <span className="text-foreground">{meta.status}</span></div>
            <div>Created by: <span className="text-foreground">{meta.createdBy}</span></div>
            <div>Created: <span className="text-foreground">{meta.createdAt}</span></div>
            <div>Published (posted date): <span className="text-foreground">{meta.publishedAt}</span></div>
          </dl>
        )}
      </FormSection>

      <div className="flex justify-end gap-2 border-t pt-6">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting || navigating} disabled={formState.isSubmitting || navigating}>
          {formState.isSubmitting || navigating ? "Saving…" : jobId ? "Save changes" : "Create job"}
        </Button>
      </div>
    </form>
  );
}
