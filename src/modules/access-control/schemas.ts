import { z } from "zod";
import { ALL_PERMISSIONS } from "@/modules/access-control/permissions";
import { email, optionalText, requiredText, uuid } from "@/lib/validation";

export const staffUserCreateSchema = z.object({
  email,
  firstName: requiredText("First name", 80),
  lastName: requiredText("Last name", 80),
  roleIds: z.array(uuid).min(1, "Assign at least one role").max(10),
  groupIds: z.array(uuid).max(50).default([]),
});

export const staffUserUpdateSchema = staffUserCreateSchema.omit({ email: true }).extend({ userId: uuid });

export const roleSchema = z.object({
  name: requiredText("Role name", 60),
  description: optionalText(300),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(ALL_PERMISSIONS.length),
});

export const groupSchema = z.object({
  name: requiredText("Group name", 80),
  description: optionalText(300),
  memberIds: z.array(uuid).max(500).default([]),
});

export type StaffUserCreateFormValues = z.input<typeof staffUserCreateSchema>;
export type StaffUserUpdateFormValues = z.input<typeof staffUserUpdateSchema>;
export type RoleFormValues = z.input<typeof roleSchema>;
export type GroupFormValues = z.input<typeof groupSchema>;
