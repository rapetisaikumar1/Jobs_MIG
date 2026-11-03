"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireStaffForAction } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { requireCandidateForAction } from "@/modules/auth/session";
import {
  addCandidateToJobSchema,
  applicationNoteSchema,
  applySchema,
  assignRecruiterSchema,
  statusUpdateSchema,
  type AddCandidateToJobFormValues,
  type ApplyFormValues,
} from "@/modules/applications/schemas";
import {
  addApplicationNote,
  addCandidateToJob,
  assignApplicationRecruiter,
  submitPortalApplication,
  updateApplicationStatus,
} from "@/modules/applications/service";

export async function applyForJobAction(values: ApplyFormValues): Promise<ActionResult<{ displayId: string }>> {
  return runAction(async () => {
    const ctx = await requireCandidateForAction();
    const parsed = applySchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await enforceRateLimit("apply", ctx.user.id);
    const result = await submitPortalApplication(ctx, parsed.data);
    revalidatePath("/candidate", "layout");
    revalidatePath(`/jobs/${result.jobDisplayId}`);
    return ok({ displayId: result.displayId }, "Application submitted.");
  });
}

export async function addCandidateToJobAction(
  values: AddCandidateToJobFormValues,
): Promise<ActionResult<{ displayId: string }>> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.CANDIDATE_ADD);
    const parsed = addCandidateToJobSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const result = await addCandidateToJob(ctx, parsed.data);
    revalidatePath("/admin", "layout");
    return ok({ displayId: result.displayId }, "Candidate added to the job.");
  });
}

export async function updateApplicationStatusAction(values: z.input<typeof statusUpdateSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.APPLICATION_UPDATE_STATUS);
    const parsed = statusUpdateSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await updateApplicationStatus(ctx, parsed.data);
    revalidatePath("/admin", "layout");
    return ok(undefined, "Status updated.");
  });
}

export async function addApplicationNoteAction(values: z.input<typeof applicationNoteSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.APPLICATION_UPDATE_STATUS);
    const parsed = applicationNoteSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await addApplicationNote(ctx, parsed.data.applicationId, parsed.data.body);
    revalidatePath("/admin", "layout");
    return ok(undefined, "Note added.");
  });
}

export async function assignRecruiterAction(values: z.input<typeof assignRecruiterSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.APPLICATION_UPDATE_STATUS);
    const parsed = assignRecruiterSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await assignApplicationRecruiter(ctx, parsed.data.applicationId, parsed.data.assignedRecruiterId ?? null);
    revalidatePath("/admin", "layout");
    return ok(undefined, "Recruiter updated.");
  });
}
