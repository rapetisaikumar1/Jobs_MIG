import { z } from "zod";
import { password, requiredText } from "@/lib/validation";

/** The signed-in staff member's own name. Email, roles and status are not editable here. */
export const profileDetailsSchema = z.object({
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
});

/** Change your own password: the current one is checked on the server first. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: "Enter your current password" }).min(1, "Enter your current password").max(200),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" })
  .refine((v) => v.password !== v.currentPassword, { path: ["password"], message: "Choose a password different from your current one" });

export type ProfileDetailsFormValues = z.input<typeof profileDetailsSchema>;
export type ChangePasswordFormValues = z.input<typeof changePasswordSchema>;
