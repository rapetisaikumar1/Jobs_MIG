"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { uuid } from "@/lib/validation";
import { requireStaffForAction } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { requireCandidateForAction } from "@/modules/auth/session";
import {
  candidateSelfProfileSchema,
  staffCandidateSchema,
  type CandidateSelfProfileFormValues,
  type StaffCandidateFormValues,
} from "@/modules/candidates/schemas";
import {
  createInternalCandidate,
  updateCandidateByStaff,
  updateOwnProfile,
  type DuplicateMatch,
} from "@/modules/candidates/service";

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

export type CreateCandidateActionData =
  | { status: "created"; displayId: string }
  | { status: "needs-confirmation"; matches: DuplicateMatch[] };

export async function createCandidateAction(
  values: StaffCandidateFormValues,
): Promise<ActionResult<CreateCandidateActionData>> {
  return runAction<CreateCandidateActionData>(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.CANDIDATE_ADD);
    const parsed = staffCandidateSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const result = await createInternalCandidate(ctx, parsed.data);
    if (result.status === "needs-confirmation") return ok(result);
    revalidatePath("/admin", "layout");
    return ok({ status: "created", displayId: result.displayId }, `Candidate ${result.displayId} created.`);
  });
}

export async function updateCandidateAction(
  candidateId: string,
  values: StaffCandidateFormValues,
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.CANDIDATE_EDIT);
    const parsed = staffCandidateSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await updateCandidateByStaff(ctx, uuid.parse(candidateId), parsed.data);
    revalidatePath("/admin", "layout");
    return ok(undefined, "Candidate updated.");
  });
}
