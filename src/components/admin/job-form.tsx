"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Field, FormSection, fieldAria } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors, errorMessage } from "@/components/forms/form-utils";
import { RegionMultiSelect } from "@/components/forms/region-multi-select";
import { TagInput } from "@/components/forms/tag-input";
import {
  COMPENSATION_TYPE_LABELS,
  CURRENCY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  toOptions,
} from "@/config/options";
import { regionsFor } from "@/config/locations";
import { jobSchema, type JobFormValues } from "@/modules/jobs/schemas";
import { createJobAction, updateJobAction } from "@/modules/jobs/actions";
import type { ClientOption } from "@/modules/clients/queries";

export function JobForm({
  jobId,
  defaultValues,
  skillSuggestions,
  clients,
  meta,
}: {
  jobId?: string;
  defaultValues: JobFormValues;
  skillSuggestions: string[];
  /** Omitted when the user cannot view clients: the Client field is then not shown. */
  clients?: ClientOption[];
  meta?: { displayId: string; createdBy: string; createdAt: string; publishedAt: string; status: string };
}) {
  const router = useRouter();
  // Keep the submit button busy until the destination page has loaded.
  const [navigating, startNavigation] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<JobFormValues>({ resolver: zodResolver(jobSchema), defaultValues });
  const { register, control, watch, handleSubmit, formState, setError: setFieldError, setValue, getValues, clearErrors } = form;
  const e = formState.errors;
  const country = watch("country");
  // Remote jobs have no city or state: those fields are hidden and not required.
  const remote = watch("workArrangement") === "REMOTE";
  // Inactive clients can't be picked for a job, but a job keeps the one it already has.
  const clientOptions = clients?.filter((c) => c.isActive || c.id === defaultValues.clientId);

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
          <Input id="title" {...fieldAria("title", e.title?.message)} placeholder="Senior Java Developer" {...register("title")} />
        </Field>
        {clientOptions && (
          <Field id="clientId" label="Client" hint="Internal only — never shown on the job portal." error={e.clientId?.message}>
            <Select id="clientId" {...fieldAria("clientId", e.clientId?.message, true)} defaultValue={String(defaultValues.clientId ?? "")} {...register("clientId")}>
              <option value="">No client</option>
              {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.isActive ? c.name : `${c.name} (inactive)`}</option>)}
            </Select>
          </Field>
        )}
        <Field id="description" label="Job description" required error={e.description?.message} className="sm:col-span-2">
          <Textarea id="description" {...fieldAria("description", e.description?.message)} rows={8} {...register("description")} />
        </Field>
        <Field id="responsibilities" label="Responsibilities" error={e.responsibilities?.message} hint="One per line" className="sm:col-span-2">
          <Textarea id="responsibilities" {...fieldAria("responsibilities", e.responsibilities?.message, true)} rows={6} {...register("responsibilities")} />
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
          <Input id="minExperience" {...fieldAria("minExperience", e.minExperience?.message)} type="number" min={0} max={50} {...register("minExperience")} />
        </Field>
        <Field id="maxExperience" label="Maximum experience (years)" error={e.maxExperience?.message}>
          <Input id="maxExperience" {...fieldAria("maxExperience", e.maxExperience?.message)} type="number" min={0} max={50} {...register("maxExperience")} />
        </Field>
        <Field id="education" label="Education requirements" error={e.education?.message} className="sm:col-span-2">
          <Input id="education" {...fieldAria("education", e.education?.message)} placeholder="Bachelor's degree in Computer Science or equivalent" {...register("education")} />
        </Field>
      </FormSection>

      <FormSection title="Employment details">
        <Field id="workArrangement" label="Work arrangement" required error={e.workArrangement?.message}>
          <Select
            id="workArrangement"
            {...fieldAria("workArrangement", e.workArrangement?.message)}
            defaultValue={defaultValues.workArrangement}
            {...register("workArrangement", {
              // The hidden location fields are ignored for remote jobs, so drop any errors they showed.
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                if (event.target.value === "REMOTE") clearErrors(["states", "city"]);
              },
            })}
          >
            {options(toOptions(WORK_ARRANGEMENT_LABELS))}
          </Select>
        </Field>
        <Field
          id="country"
          label="Country"
          required
          hint={remote ? "Candidates must be eligible to work in this country." : undefined}
          error={e.country?.message}
        >
          <Select
            id="country"
            {...fieldAria("country", e.country?.message, remote)}
            defaultValue={defaultValues.country}
            {...register("country", {
              // Keep only the selected states / provinces that belong to the new country.
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                const codes = new Set(regionsFor(event.target.value).map((r) => r.code));
                setValue("states", (getValues("states") ?? []).filter((code) => codes.has(code)), { shouldValidate: formState.isSubmitted });
              },
            })}
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </Select>
        </Field>
        {!remote && (
          <>
            <Field id="states" label="State / Province" required hint="Select every state or province this job is open in." error={errorMessage(e as Record<string, unknown>, "states")}>
              <Controller control={control} name="states" render={({ field }) => (
                <RegionMultiSelect
                  id="states"
                  ref={field.ref}
                  country={country}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!e.states}
                />
              )} />
            </Field>
            <Field id="city" label="City" required error={e.city?.message}>
              <Input id="city" {...fieldAria("city", e.city?.message)} {...register("city")} />
            </Field>
          </>
        )}
        <Field id="employmentType" label="Employment type" required error={e.employmentType?.message}>
          <Select id="employmentType" {...fieldAria("employmentType", e.employmentType?.message)} defaultValue={defaultValues.employmentType} {...register("employmentType")}>{options(toOptions(EMPLOYMENT_TYPE_LABELS))}</Select>
        </Field>
        <Field id="compensationType" label="Pay type" required error={e.compensationType?.message}>
          <Select id="compensationType" {...fieldAria("compensationType", e.compensationType?.message)} defaultValue={defaultValues.compensationType} {...register("compensationType")}>{options(toOptions(COMPENSATION_TYPE_LABELS))}</Select>
        </Field>
        <Field id="compensationMin" label="Salary / rate minimum" error={e.compensationMin?.message}>
          <Input id="compensationMin" {...fieldAria("compensationMin", e.compensationMin?.message)} type="number" min={0} step="any" {...register("compensationMin")} />
        </Field>
        <Field id="compensationMax" label="Salary / rate maximum" error={e.compensationMax?.message}>
          <Input id="compensationMax" {...fieldAria("compensationMax", e.compensationMax?.message)} type="number" min={0} step="any" {...register("compensationMax")} />
        </Field>
        <Field id="currency" label="Currency" required error={e.currency?.message}>
          <Select id="currency" {...fieldAria("currency", e.currency?.message)} defaultValue={defaultValues.currency} {...register("currency")}>{options(toOptions(CURRENCY_LABELS))}</Select>
        </Field>
        <Field id="applicationDeadline" label="Application deadline" error={e.applicationDeadline?.message} hint="Inclusive. Leave empty for open until filled.">
          <Input id="applicationDeadline" {...fieldAria("applicationDeadline", e.applicationDeadline?.message, true)} type="date" {...register("applicationDeadline")} />
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox id="salaryPublic" className="mt-0.5" {...fieldAria("salaryPublic", e.salaryPublic?.message)} {...register("salaryPublic")} />
            <span>Show salary / rate on the public job portal<span className="block text-xs text-muted-foreground">Only when approved for public display.</span></span>
          </label>
          {e.salaryPublic && <p id="salaryPublic-error" className="mt-1 text-xs text-destructive">{e.salaryPublic.message}</p>}
        </div>
      </FormSection>

      {meta && (
        <FormSection title="Record">
          <dl className="grid gap-2 text-xs text-muted-foreground sm:col-span-2 sm:grid-cols-2">
            <div>Status: <span className="text-foreground">{meta.status}</span></div>
            <div>Created by: <span className="text-foreground">{meta.createdBy}</span></div>
            <div>Created: <span className="text-foreground">{meta.createdAt}</span></div>
            <div>Published (posted date): <span className="text-foreground">{meta.publishedAt}</span></div>
          </dl>
        </FormSection>
      )}

      {/* The last FormSection already draws the divider above the buttons. */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting || navigating} disabled={formState.isSubmitting || navigating}>
          {formState.isSubmitting || navigating ? "Saving…" : jobId ? "Save changes" : "Create job"}
        </Button>
      </div>
    </form>
  );
}
