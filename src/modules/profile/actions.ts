"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { runAction } from "@/lib/action";
import { AppError, fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { reserveSubjectAttempt } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireStaffForAction } from "@/modules/access-control/context";
import {
  changePasswordSchema,
  profileDetailsSchema,
  type ChangePasswordFormValues,
  type ProfileDetailsFormValues,
} from "@/modules/profile/schemas";

/** Updates the signed-in staff member's own first and last name (nothing else). */
export async function updateProfileAction(values: ProfileDetailsFormValues): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction();
    const parsed = profileDetailsSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await prisma.user.update({
      where: { id: ctx.user.id },
      data: { firstName: parsed.data.firstName, lastName: parsed.data.lastName },
    });
    // The name shows in the sidebar on every admin page.
    revalidatePath("/admin", "layout");
    return ok(undefined, "Profile updated.");
  });
}

/**
 * Checks a password with a throwaway, cookie-less client, so the user's own session (cookies)
 * is never replaced. The extra session it creates is signed out straight away.
 */
async function isCurrentPassword(userId: string, email: string, password: string): Promise<boolean> {
  const verifier = createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.signInWithPassword({ email, password });
  if (error || !data.user) return false;
  await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
  return data.user.id === userId;
}

/** Changes the signed-in staff member's own password after confirming the current one. */
export async function changePasswordAction(values: ChangePasswordFormValues): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction();
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);

    // Same limits as sign-in (10 wrong passwords per 15 minutes), counted per account. Only
    // failed checks count: the attempt is given back once the current password is confirmed.
    const refundAttempt = await reserveSubjectAttempt("login", `password-change:${ctx.user.id}`);
    if (!(await isCurrentPassword(ctx.user.id, ctx.user.email, parsed.data.currentPassword))) {
      return fail("Your current password is incorrect.", { currentPassword: ["Your current password is incorrect."] });
    }
    await refundAttempt();

    const { error } = await supabaseAdmin().auth.admin.updateUserById(ctx.user.id, { password: parsed.data.password });
    if (error) {
      if (error.code === "weak_password") throw new AppError("The new password is too weak. Use a longer password with letters and numbers.");
      if (error.code === "same_password") throw new AppError("Choose a password different from your current one.");
      console.error("[profile] password change failed", error.code, error.message);
      throw new AppError("Could not change your password. Please try again.");
    }
    return ok(undefined, "Password changed. Use the new password the next time you sign in.");
  });
}
