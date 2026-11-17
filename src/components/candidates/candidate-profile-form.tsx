"use client";

import * as React from "react";
import { Controller, useForm, type UseFormRegisterReturn } from "react-hook-form";
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
  COUNTRY_LABELS,
  CURRENCY_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  QUALIFICATION_LABELS,
  WORK_ARRANGEMENT_LABELS,
  WORK_AUTH_STATUS_LABELS,
  toOptions,
} from "@/config/options";
import { candidateSelfProfileSchema, type CandidateSelfProfileFormValues } from "@/modules/candidates/schemas";
import { updateOwnProfileAction } from "@/modules/candidates/actions";

function Options({ labels, empty }: { labels: Record<string, string>; empty?: string }) {
  return (
    <>
      {empty !== undefined && <option value="">{empty}</option>}
      {toOptions(labels).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </>
  );
}

function CheckboxGroup({ labels, registration }: { labels: Record<string, string>; registration: UseFormRegisterReturn }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
      {toOptions(labels).map((o) => (
        <label key={o.value} className="flex items-center gap-2 text-sm">
          <Checkbox value={o.value} {...registration} /> {o.label}
        </label>
      ))}
    </div>
  );
}

/** The signed-in candidate's own profile (candidate portal). */
export function CandidateProfileForm({
  defaultValues,
  skillSuggestions = [],
}: {
  /** Only "self" remains (staff editing was removed); accepted so existing callers keep compiling. */
  mode?: "self";
  /** Extra keys (e.g. email) are ignored: the schema strips them and email is managed by the account. */
  defaultValues: CandidateSelfProfileFormValues & { email?: string };
  skillSuggestions?: string[];
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const form = useForm<CandidateSelfProfileFormValues>({
    resolver: zodResolver(candidateSelfProfileSchema),
    defaultValues,
  });
  const { register, control, watch, handleSubmit, formState, setError: setFieldError, setValue } = form;
  const errors = formState.errors as Record<string, unknown>;
  const err = (name: string) => errorMessage(errors, name);
  const country = watch("country");

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setSuccess(null);
    const result = await updateOwnProfileAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerErrors(result, setFieldError);
    } else {
      setSuccess(result.message ?? "Saved.");
      // The action calls revalidatePath, so its response already re-renders this page.
    }
  });

  const tagField = (name: keyof CandidateSelfProfileFormValues, label: string, hint?: string, suggestions?: string[]) => (
    <Field id={name} label={label} hint={hint} error={err(name)} className="sm:col-span-2">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TagInput id={name} value={(field.value as string[]) ?? []} onChange={field.onChange} suggestions={suggestions} invalid={!!err(name)} />
        )}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <FormAlert error={error} success={success} />

      <FormSection title="Personal information" description="Your email address is your sign-in and cannot be changed here.">
        <Field id="firstName" label="First name" required error={err("firstName")}>
          <Input id="firstName" {...register("firstName")} />
        </Field>
        <Field id="lastName" label="Last name" required error={err("lastName")}>
          <Input id="lastName" {...register("lastName")} />
        </Field>
        <Field id="phone" label="Phone" required error={err("phone")} hint="US/Canada: (416) 555-0100 · other: +44 20 7946 0958">
          <Input id="phone" type="tel" {...register("phone")} />
        </Field>
        <Field id="alternatePhone" label="Alternate phone" error={err("alternatePhone")}>
          <Input id="alternatePhone" type="tel" {...register("alternatePhone")} />
        </Field>
        <Field id="country" label="Country" required error={err("country")}>
          <Select id="country" {...register("country", { onChange: () => setValue("state", "") })}>
            <Options labels={COUNTRY_LABELS} />
          </Select>
        </Field>
        <Field id="state" label="State / Province" error={err("state")}>
          <RegionSelect id="state" country={country} invalid={!!err("state")} {...register("state")} />
        </Field>
        <Field id="city" label="City" error={err("city")}>
          <Input id="city" {...register("city")} />
        </Field>
        <Field id="postalCode" label="ZIP / Postal code" error={err("postalCode")}>
          <Input id="postalCode" {...register("postalCode")} />
        </Field>
        <Field id="linkedinUrl" label="LinkedIn profile URL" error={err("linkedinUrl")} className="sm:col-span-2">
          <Input id="linkedinUrl" type="url" placeholder="https://www.linkedin.com/in/…" {...register("linkedinUrl")} />
        </Field>
      </FormSection>

      <FormSection title="Professional information">
        <Field id="professionalTitle" label="Professional title" error={err("professionalTitle")} hint="e.g. Senior Java Developer">
          <Input id="professionalTitle" {...register("professionalTitle")} />
        </Field>
        <Field id="currentTitle" label="Current job title" error={err("currentTitle")}>
          <Input id="currentTitle" {...register("currentTitle")} />
        </Field>
        <Field id="currentEmployer" label="Current employer" error={err("currentEmployer")}>
          <Input id="currentEmployer" {...register("currentEmployer")} />
        </Field>
        <Field id="highestQualification" label="Highest qualification" error={err("highestQualification")}>
          <Select id="highestQualification" {...register("highestQualification")}>
            <Options labels={QUALIFICATION_LABELS} empty="Select" />
          </Select>
        </Field>
        <Field id="totalExperienceYears" label="Total experience (years)" error={err("totalExperienceYears")}>
          <Input id="totalExperienceYears" type="number" min={0} max={60} step={0.5} {...register("totalExperienceYears")} />
        </Field>
        <Field id="relevantExperienceYears" label="Relevant experience (years)" error={err("relevantExperienceYears")}>
          <Input id="relevantExperienceYears" type="number" min={0} max={60} step={0.5} {...register("relevantExperienceYears")} />
        </Field>
        {tagField("primarySkills", "Primary skills", "Your strongest skills. Press Enter after each.", skillSuggestions)}
        {tagField("secondarySkills", "Secondary skills", undefined, skillSuggestions)}
        <Field id="education" label="Education" error={err("education")} hint="Degree, institution, year" className="sm:col-span-2">
          <Textarea id="education" rows={3} {...register("education")} />
        </Field>
        {tagField("certifications", "Certifications", "e.g. AWS Certified Solutions Architect")}
      </FormSection>

      <FormSection title="Job preferences">
        {tagField("preferredJobTitles", "Preferred job titles")}
        {tagField("preferredLocations", "Preferred work locations", "e.g. Toronto, Remote (US)")}
        <Field id="preferredWorkArrangements" label="Preferred work arrangement" error={err("preferredWorkArrangements")}>
          <CheckboxGroup labels={WORK_ARRANGEMENT_LABELS} registration={register("preferredWorkArrangements")} />
        </Field>
        <Field id="preferredEmploymentTypes" label="Preferred employment type" error={err("preferredEmploymentTypes")}>
          <CheckboxGroup labels={EMPLOYMENT_TYPE_LABELS} registration={register("preferredEmploymentTypes")} />
        </Field>
        <Field id="expectedCompensation" label="Expected salary / hourly rate" error={err("expectedCompensation")}>
          <Input id="expectedCompensation" type="number" min={0} step="any" {...register("expectedCompensation")} />
        </Field>
        <Field id="compensationType" label="Pay type" error={err("compensationType")}>
          <Select id="compensationType" {...register("compensationType")}>
            <Options labels={COMPENSATION_TYPE_LABELS} empty="Select" />
          </Select>
        </Field>
        <Field id="currency" label="Currency" error={err("currency")}>
          <Select id="currency" {...register("currency")}>
            <Options labels={CURRENCY_LABELS} empty="Select" />
          </Select>
        </Field>
        <Field id="noticePeriodDays" label="Notice period (days)" error={err("noticePeriodDays")} hint="0 if available immediately">
          <Input id="noticePeriodDays" type="number" min={0} max={365} {...register("noticePeriodDays")} />
        </Field>
        <Field id="availableFrom" label="Available from" error={err("availableFrom")}>
          <Input id="availableFrom" type="date" {...register("availableFrom")} />
        </Field>
      </FormSection>

      <FormSection title="Work authorization" description="Only a general status is collected. Never upload immigration documents.">
        <Field id="workAuthCountry" label="Country" error={err("workAuthCountry")}>
          <Select id="workAuthCountry" {...register("workAuthCountry")}>
            <Options labels={{ US: COUNTRY_LABELS.US, CA: COUNTRY_LABELS.CA }} empty="Select" />
          </Select>
        </Field>
        <Field id="workAuthStatus" label="Status" error={err("workAuthStatus")}>
          <Select id="workAuthStatus" {...register("workAuthStatus")}>
            <Options labels={WORK_AUTH_STATUS_LABELS} empty="Select" />
          </Select>
        </Field>
      </FormSection>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={formState.isSubmitting} disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
