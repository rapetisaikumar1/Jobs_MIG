import { z } from "zod";
import { APPLICATION_STATUS_LABELS } from "@/config/options";
import { checkbox, enumValues, optionalNumber, optionalText, optionalUuid, requiredText, uuid } from "@/lib/validation";

export const applySchema = z
  .object({
    jobId: uuid,
    resumeChoice: z.enum(["profile", "upload"]),
    /** Pending upload when resumeChoice = "upload". */
    resumeDocumentId: optionalUuid,
    saveAsDefaultResume: checkbox,
    coverLetterDocumentId: optionalUuid,
    supportingDocumentIds: z.array(uuid).max(5, "Attach at most 5 supporting documents").default([]),
    relevantExperienceYears: optionalNumber(0, 60),
    relevantExperienceSummary: optionalText(2000),
    availability: requiredText("Availability", 200),
    workAuthorizationResponse: optionalText(300),
    additionalComments: optionalText(2000),
    confirmAccurate: z.literal(true, { error: "Please confirm your information is accurate" }),
  })
  .refine((v) => v.resumeChoice !== "upload" || !!v.resumeDocumentId, {
    path: ["resumeDocumentId"],
    message: "Upload a resume",
  });

export const statusUpdateSchema = z.object({
  applicationId: uuid,
  status: z.enum(enumValues(APPLICATION_STATUS_LABELS)),
  note: optionalText(1000),
});

export const applicationNoteSchema = z.object({
  applicationId: uuid,
  body: requiredText("Note", 5000),
});

export type ApplyInput = z.output<typeof applySchema>;
export type ApplyFormValues = z.input<typeof applySchema>;
