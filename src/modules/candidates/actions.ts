"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { requireCandidateForAction } from "@/modules/auth/session";
import { candidateSelfProfileSchema, type CandidateSelfProfileFormValues } from "@/modules/candidates/schemas";
import { updateOwnProfile } from "@/modules/candidates/service";

export async function updateOwnProfileAction(values: CandidateSelfProfileFormValues): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireCandidateForAction();
    const parsed = candidateSelfProfileSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await updateOwnProfile(ctx.profile.id, parsed.data);
    revalidatePath("/candidate", "layout");
    return ok(undefined, "Profile saved.");
  });
}
