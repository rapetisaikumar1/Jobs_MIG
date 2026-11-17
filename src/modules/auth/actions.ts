"use server";

import { redirect } from "next/navigation";
import { runAction } from "@/lib/action";
import { fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, enforceRateLimit, recordIpHit, reserveSubjectAttempt } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isStaffSession, STAFF_PORTAL } from "@/modules/auth/portal";
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

/** Shown when a staff login is used on the job portal. Staff sign in only through the admin portal. */
const STAFF_ON_JOB_PORTAL = "This is a MaverickInnogarage staff account. Staff accounts can't sign in to the job portal; please use the admin portal sign-in.";

/**
 * Marks the login as staff in Supabase app_metadata (only the service-role key can write it) so
 * the middleware can keep staff on the admin portal without a database lookup, then refreshes the
 * session so the new access token carries the mark. Best effort: the job-portal layout performs
 * the same check against the database, so a failure here never blocks the sign-in.
 */
async function stampStaffSession(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, user: { id: string; app_metadata?: unknown }) {
  if (isStaffSession(user.app_metadata)) return;
  try {
    const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, { app_metadata: { portal: STAFF_PORTAL } });
    if (error) throw error;
    await supabase.auth.refreshSession();
  } catch (error) {
    console.error("[auth] could not mark staff session", error);
  }
}

/** Where a candidate goes after sign-up: a job-portal ?next= path (never /admin), else the profile. */
function candidateNext(next: string | undefined): string {
  const fallback = "/candidate/profile?welcome=1";
  const cleaned = safeNextPath(next, fallback);
  return cleaned === "/admin" || cleaned.startsWith("/admin/") ? fallback : cleaned;
}

export async function registerAction(values: z.input<typeof registerSchema>, next?: string): Promise<ActionResult> {
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
      options: { emailRedirectTo: confirmUrl(candidateNext(next)), data: metadata },
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
export async function verifyEmailCodeAction(values: z.input<typeof verifyEmailCodeSchema>, next?: string): Promise<ActionResult> {
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
    if (appUser?.type === "STAFF") {
      await supabase.auth.signOut({ scope: "local" });
      return fail(STAFF_ON_JOB_PORTAL);
    }
    const account = await ensureCandidateAccount(data.user);
    if (!account || !account.isActive) {
      await supabase.auth.signOut({ scope: "local" });
      return fail("This account cannot sign in to the job portal. Please contact us.");
    }
    return ok(candidateNext(next));
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
    const refundAttempt = await reserveSubjectAttempt("login", parsed.data.email);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      await recordIpHit("login");
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
    await refundAttempt();

    const appUser = await prisma.user.findUnique({ where: { id: data.user.id } });
    if (portal === "staff") {
      if (!appUser || appUser.type !== "STAFF" || !appUser.isActive) {
        await supabase.auth.signOut({ scope: "local" });
        return fail("This sign-in is for MaverickInnogarage staff only.");
      }
      await stampStaffSession(supabase, data.user);
      return ok("/admin/jobs");
    }

    // The job portal is for candidates only; staff must use the admin sign-in.
    if (appUser?.type === "STAFF") {
      await supabase.auth.signOut({ scope: "local" });
      return fail(STAFF_ON_JOB_PORTAL);
    }
    const account = await ensureCandidateAccount(data.user);
    if (!account || !account.isActive) {
      await supabase.auth.signOut({ scope: "local" });
      return fail("This account cannot sign in to the job portal. Please contact us.");
    }
    return ok("/candidate/dashboard");
  });
  if (!result.ok) return result;

  // Honour ?next= only within the portal the user actually belongs to.
  const fallback = result.data;
  const cleaned = safeNextPath(next, fallback);
  const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/");
  // Compare the cleaned path, so "/admin/..//x" style input can't slip past the portal check.
  redirect(isAdminPath(fallback) === isAdminPath(cleaned) ? cleaned : fallback);
}

export async function logoutAction(portal: "candidate" | "staff" = "candidate") {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
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
    if (appUser?.type === "STAFF") {
      await stampStaffSession(supabase, data.user);
      return ok("/admin/jobs");
    }
    return ok("/candidate/dashboard");
  });
  if (!result.ok) return result;
  redirect(result.data);
}
