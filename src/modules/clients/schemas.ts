import { z } from "zod";
import { optionalEmail, optionalPhone, optionalText, optionalUrl, requiredText } from "@/lib/validation";

/** A client (the company a job is for). Internal only: never shown on the job portal. */
export const clientSchema = z.object({
  name: requiredText("Source name", 150),
  contactName: optionalText(150),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
  website: optionalUrl,
  notes: optionalText(2000),
});

export type ClientFormValues = z.input<typeof clientSchema>;
export type ClientInput = z.output<typeof clientSchema>;

export const EMPTY_CLIENT: ClientFormValues = { name: "", contactName: "", contactEmail: "", contactPhone: "", website: "", notes: "" };

export const CLIENT_STATUS_FILTERS = { active: "Active", inactive: "Inactive" } as const;
export type ClientStatusFilter = keyof typeof CLIENT_STATUS_FILTERS;
