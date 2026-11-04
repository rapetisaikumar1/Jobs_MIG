"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/action";
import { fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, enforceRateLimit, recordRateLimitHit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureCandidateAccount, type CandidateSignupMetadata } from "@/modules/auth/provisioning";
import { safeNextPath } from "@/modules/auth/redirects";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailCodeSchema,
} from "@/modules/auth/schemas";
import type { z } from "zod";

const confirmUrl = (next: string) => `${serverEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;

export async function registerAction(values: z.input<typeof registerSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const input = parsed.data;
    await enforceRateLimit("register", input.email);

    const metadata: CandidateSignupMetadata = {
      account_type: "candidate",
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      country: input.country,
    };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: confirmUrl("/candidate/profile?welcome=1"), data: metadata },
    });
    if (error) {
      if (error.code === "weak_password") return fail("Please choose a stronger password.");
      if (error.code !== "user_already_exists") console.error("[auth] sign-up failed", error.code, error.message);
    }
    // Same response whether or not the email is already registered (prevents account enumeration).
    return ok(undefined, "We've emailed you a 6-digit verification code.");
  });
}

/**
 * Completes sign-up: checks the one-time code from the verification email. On success
 * Supabase confirms the email and starts a session, and the candidate account is created.
 */
export async function verifyEmailCodeAction(values: z.input<typeof verifyEmailCodeSchema>): Promise<ActionResult> {
  const result = await runAction(async () => {
    const parsed = verifyEmailCodeSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const { email, code } = parsed.data;
    await enforceRateLimit("verifyCode", email);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error || !data.user) {
      // Wrong and expired codes both come back as "otp_expired"; anything else is worth logging.
      if (error && error.code !== "otp_expired") console.error("[auth] code verification failed", error.code, error.message);
      return fail("That code is incorrect or has expired. Check the latest email, or send a new code.");
    }

    const appUser = await prisma.user.findUnique({ where: { id: data.user.id }, select: { type: true } });
    if (appUser?.type === "STAFF") return ok("/admin/jobs");
    const account = await ensureCandidateAccount(data.user);
    if (!account || !account.isActive) {
      await supabase.auth.signOut();
      return fail("This account cannot sign in to the job portal. Please contact us.");
    }
    return ok("/candidate/profile?welcome=1");
  });
  if (!result.ok) return result;
  redirect(result.data);
}

export async function loginAction(
  values: z.input<typeof loginSchema>,
  portal: "candidate" | "staff",
  next?: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await checkRateLimit("login", parsed.data.email);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      await recordRateLimitHit("login", parsed.data.email);
      if (error?.code === "user_banned") {
        return fail("This account has been deactivated. Contact an administrator.");
      }
      if (error?.code === "email_not_confirmed") {
        return fail(
          portal === "candidate"
            ? "Please verify your email address first. Enter the code we emailed you, or send a new one."
            : "Please verify your email address first. Check your inbox for the verification link.",
        );
      }
      return fail("Incorrect email or password.");
    }

    const appUser = await prisma.user.findUnique({ where: { id: data.user.id } });
    if (portal === "staff") {
      if (!appUser || appUser.type !== "STAFF" || !appUser.isActive) {
        await supabase.auth.signOut();
        return fail("This sign-in is for MaverickInnogarage staff only.");
      }
      return ok("/admin/jobs");
    }

    if (appUser?.type === "STAFF") return ok("/admin/jobs");
    const account = await ensureCandidateAccount(data.user);
    if (!account || !account.isActive) {
      await supabase.auth.signOut();
      return fail("This account cannot sign in to the job portal. Please contact us.");
    }
    return ok("/candidate/dashboard");
  });
  if (!result.ok) return result;

  // Honour ?next= only within the portal the user actually belongs to.
  const fallback = result.data;
  const nextAllowed = fallback.startsWith("/admin") ? next?.startsWith("/admin") : !next?.startsWith("/admin");
  redirect(nextAllowed ? safeNextPath(next, fallback) : fallback);
}

export async function logoutAction(portal: "candidate" | "staff" = "candidate") {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(portal === "staff" ? "/admin/login" : "/");
}

export async function forgotPasswordAction(values: z.input<typeof forgotPasswordSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await enforceRateLimit("passwordReset", parsed.data.email);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: confirmUrl("/reset-password"),
    });
    if (error) console.error("[auth] reset request failed", error.code, error.message);
    return ok(undefined, "If an account exists for this email, we've sent a password reset link.");
  });
}

export async function resendVerificationAction(values: z.input<typeof forgotPasswordSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await enforceRateLimit("passwordReset", parsed.data.email);
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo: confirmUrl("/candidate/profile?welcome=1") },
    });
    return ok(undefined, "If the account is awaiting verification, a new code has been sent.");
  });
}

export async function resetPasswordAction(values: z.input<typeof resetPasswordSchema>): Promise<ActionResult> {
  const result = await runAction(async () => {
    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return fail("Your reset link has expired. Please request a new one.");
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      return fail(error.code === "same_password" ? "Choose a password you haven't used before." : "Could not update your password.");
    }
    const appUser = await prisma.user.findUnique({ where: { id: data.user.id }, select: { type: true } });
    return ok(appUser?.type === "STAFF" ? "/admin/jobs" : "/candidate/dashboard");
  });
  if (!result.ok) return result;
  redirect(result.data);
}
