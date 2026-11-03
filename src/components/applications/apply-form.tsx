"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/form-utils";
import { DetailList } from "@/components/shared/detail-list";
import { DocumentUploader, MultiDocumentUploader, type UploadedFile } from "@/components/documents/document-uploader";
import { applySchema, type ApplyFormValues } from "@/modules/applications/schemas";
import { applyForJobAction } from "@/modules/applications/actions";

/**
 * Two steps: fill in (pre-filled from the saved profile), then review and submit.
 * Documents are uploaded directly to private storage and attached on submit.
 */
export function ApplyForm({
  jobId,
  jobTitle,
  defaultResume,
  defaults,
}: {
  jobId: string;
  jobTitle: string;
  defaultResume: { id: string; fileName: string } | null;
  defaults: { relevantExperienceYears?: number; availability?: string; workAuthorizationResponse?: string };
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<"edit" | "review">("edit");
  const [error, setError] = React.useState<string | null>(null);
  const [resumeFile, setResumeFile] = React.useState<UploadedFile | null>(null);
  const [coverLetter, setCoverLetter] = React.useState<UploadedFile | null>(null);
  const [supporting, setSupporting] = React.useState<UploadedFile[]>([]);

  const form = useForm<ApplyFormValues>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      jobId,
      resumeChoice: defaultResume ? "profile" : "upload",
      resumeDocumentId: "",
      saveAsDefaultResume: !defaultResume,
      coverLetterDocumentId: "",
      supportingDocumentIds: [],
      relevantExperienceYears: defaults.relevantExperienceYears?.toString() ?? "",
      relevantExperienceSummary: "",
      availability: defaults.availability ?? "",
      workAuthorizationResponse: defaults.workAuthorizationResponse ?? "",
      additionalComments: "",
      confirmAccurate: false as unknown as true,
    },
  });
  const { register, control, watch, setValue, formState, setError: setFieldError, trigger, getValues } = form;
  const e = formState.errors;
  const resumeChoice = watch("resumeChoice");

  React.useEffect(() => setValue("resumeDocumentId", resumeFile?.documentId ?? ""), [resumeFile, setValue]);
  React.useEffect(() => setValue("coverLetterDocumentId", coverLetter?.documentId ?? ""), [coverLetter, setValue]);
  React.useEffect(() => setValue("supportingDocumentIds", supporting.map((f) => f.documentId)), [supporting, setValue]);

  async function goToReview() {
    // Zod skips object-level refinements while other fields (the final confirmation) are
    // still invalid, so check the resume explicitly before the review step.
    if (getValues("resumeChoice") === "upload" && !getValues("resumeDocumentId")) {
      setFieldError("resumeDocumentId", { type: "required", message: "Upload a resume" });
      return;
    }
    const valid = await trigger([
      "resumeChoice",
      "resumeDocumentId",
      "relevantExperienceYears",
      "relevantExperienceSummary",
      "availability",
      "workAuthorizationResponse",
      "additionalComments",
    ]);
    if (valid) {
      setStep("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = await applyForJobAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerErrors(result, setFieldError);
      if (result.fieldErrors) setStep("edit");
      return;
    }
    router.push(`/candidate/applications/${result.data.displayId}?submitted=1`);
  });

  const v = getValues();
  const resumeName = resumeChoice === "profile" ? defaultResume?.fileName : resumeFile?.fileName;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormAlert error={error} />

      <div className={step === "edit" ? "space-y-6" : "hidden"}>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Resume <span className="text-destructive">*</span></legend>
          {defaultResume && (
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" value="profile" {...register("resumeChoice")} />
              Use my saved resume: <span className="font-medium">{defaultResume.fileName}</span>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" value="upload" {...register("resumeChoice")} />
            Upload a different resume
          </label>
          {resumeChoice === "upload" && (
            <div className="space-y-2 pl-6">
              <DocumentUploader id="resume" type="RESUME" value={resumeFile} onChange={setResumeFile} invalid={!!e.resumeDocumentId} />
              {e.resumeDocumentId && <p className="text-xs text-destructive">{e.resumeDocumentId.message}</p>}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox {...register("saveAsDefaultResume")} /> Also save as my default resume for future applications
              </label>
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="coverLetter" label="Cover letter" hint="Optional">
            <DocumentUploader id="coverLetter" type="COVER_LETTER" value={coverLetter} onChange={setCoverLetter} />
          </Field>
          <Field id="supporting" label="Supporting documents" hint="Optional · up to 5 (certificates, portfolio)">
            <MultiDocumentUploader id="supporting" type="SUPPORTING" value={supporting} onChange={setSupporting} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="relevantExperienceYears" label="Relevant experience (years)" error={e.relevantExperienceYears?.message}>
            <Input id="relevantExperienceYears" type="number" min={0} max={60} step={0.5} {...register("relevantExperienceYears")} />
          </Field>
          <Field id="availability" label="Availability" required error={e.availability?.message} hint="e.g. 2 weeks' notice, immediately">
            <Input id="availability" {...register("availability")} />
          </Field>
        </div>
        <Field id="relevantExperienceSummary" label="Relevant experience summary" error={e.relevantExperienceSummary?.message} hint="Optional · highlight experience relevant to this role">
          <Textarea id="relevantExperienceSummary" rows={4} {...register("relevantExperienceSummary")} />
        </Field>
        <Field id="workAuthorizationResponse" label="Work authorization for this role" error={e.workAuthorizationResponse?.message} hint="e.g. Canadian citizen, US Green Card holder, requires sponsorship">
          <Input id="workAuthorizationResponse" {...register("workAuthorizationResponse")} />
        </Field>
        <Field id="additionalComments" label="Additional comments" error={e.additionalComments?.message} hint="Optional">
          <Textarea id="additionalComments" rows={3} {...register("additionalComments")} />
        </Field>

        <div className="flex justify-end">
          <Button onClick={goToReview}>Review application</Button>
        </div>
      </div>

      {step === "review" && (
        <div className="space-y-6">
          <div className="rounded-md border p-4">
            <h3 className="mb-3 text-sm font-semibold">Review your application for {jobTitle}</h3>
            <DetailList
              items={[
                { label: "Resume", value: resumeName },
                { label: "Cover letter", value: coverLetter?.fileName ?? "None" },
                { label: "Supporting documents", value: supporting.length ? supporting.map((f) => f.fileName).join(", ") : "None" },
                { label: "Relevant experience", value: v.relevantExperienceYears ? `${v.relevantExperienceYears} years` : "—" },
                { label: "Availability", value: String(v.availability ?? "") },
                { label: "Work authorization", value: String(v.workAuthorizationResponse ?? "") },
                { label: "Experience summary", value: String(v.relevantExperienceSummary ?? ""), wide: true },
                { label: "Comments", value: String(v.additionalComments ?? ""), wide: true },
              ]}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Your current profile details are included with this application. To change them,{" "}
              <Link href="/candidate/profile" className="underline">update your profile</Link> before submitting.
            </p>
          </div>
          <Controller
            control={control}
            name="confirmAccurate"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" checked={!!field.value} onChange={(ev) => field.onChange(ev.target.checked)} />
                I confirm the information in my profile and this application is accurate, and I consent to MaverickInnogarage
                sharing my application with the hiring employer for this role.
              </label>
            )}
          />
          {e.confirmAccurate && <p className="text-xs text-destructive">{e.confirmAccurate.message}</p>}
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep("edit")}>Back</Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Submitting…" : "Submit application"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
