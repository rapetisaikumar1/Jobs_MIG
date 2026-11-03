import { z } from "zod";
import { COUNTRY_LABELS } from "@/config/options";
import { email, enumValues, password, phone, requiredText } from "@/lib/validation";

export const registerSchema = z
  .object({
    firstName: requiredText("First name", 80),
    lastName: requiredText("Last name", 80),
    email,
    phone,
    country: z.enum(enumValues(COUNTRY_LABELS), { error: "Select a country" }),
    password,
    confirmPassword: z.string(),
    acceptPrivacy: z.literal(true, { error: "You must accept the privacy notice to continue" }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(200),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
