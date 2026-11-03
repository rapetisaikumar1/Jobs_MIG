import { z } from "zod";
import { ALL_PERMISSIONS } from "@/modules/access-control/permissions";
import { email, optionalText, password, requiredText, uuid } from "@/lib/validation";

const staffUserFields = {
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
  roleIds: z.array(uuid).min(1, "Assign at least one role").max(10),
};

const passwordsMatch = { path: ["confirmPassword"], message: "Passwords do not match" };

/** Staff account created directly in the admin portal (no email invitation). */
export const staffUserCreateSchema = z
  .object({ ...staffUserFields, email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);

export const staffUserUpdateSchema = z.object({ ...staffUserFields, userId: uuid });

/** An admin sets a new password for a staff user (account recovery). */
export const staffPasswordSchema = z
  .object({ userId: uuid, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);

export const roleSchema = z.object({
  name: requiredText("Role name", 60),
  description: optionalText(300),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(ALL_PERMISSIONS.length),
});

export type StaffUserCreateFormValues = z.input<typeof staffUserCreateSchema>;
export type StaffUserUpdateFormValues = z.input<typeof staffUserUpdateSchema>;
export type StaffPasswordFormValues = z.input<typeof staffPasswordSchema>;
export type RoleFormValues = z.input<typeof roleSchema>;
