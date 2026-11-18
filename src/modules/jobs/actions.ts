"use server";

import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/ttl-cache";
import { PUBLIC_JOBS_CACHE } from "@/modules/jobs/queries";
import { z } from "zod";
import { runAction } from "@/lib/action";
import { fail, ok, validationFailure, type ActionResult } from "@/lib/action-result";
import { uuid } from "@/lib/validation";
import { requireStaffForAction } from "@/modules/access-control/context";
import { PERMISSIONS } from "@/modules/access-control/permissions";
import { jobSchema, type JobFormValues } from "@/modules/jobs/schemas";
import { changeJobStatus, createJob, InvalidJobClientError, updateJob } from "@/modules/jobs/service";

/** Saves the job; a rejected client choice is shown on the Client field, not only above the form. */
async function saveJob<T>(save: () => Promise<T>): Promise<{ ok: true; job: T } | { ok: false; result: ActionResult<never> }> {
  try {
    return { ok: true, job: await save() };
  } catch (error) {
    if (error instanceof InvalidJobClientError) {
      return { ok: false, result: fail("Please correct the highlighted fields.", { clientId: [error.message] }) };
    }
    throw error;
  }
}

export async function createJobAction(values: JobFormValues): Promise<ActionResult<{ displayId: string }>> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.JOB_CREATE);
    const parsed = jobSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const saved = await saveJob(() => createJob(ctx, parsed.data));
    if (!saved.ok) return saved.result;
    const { job } = saved;
    invalidateCache(PUBLIC_JOBS_CACHE);
    revalidatePath("/admin", "layout");
    return ok({ displayId: job.displayId }, `Job ${job.displayId} created with case file.`);
  });
}

export async function updateJobAction(jobId: string, values: JobFormValues): Promise<ActionResult<{ displayId: string }>> {
  return runAction(async () => {
    const ctx = await requireStaffForAction(PERMISSIONS.JOB_EDIT);
    const id = uuid.parse(jobId);
    const parsed = jobSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    const saved = await saveJob(() => updateJob(ctx, id, parsed.data));
    if (!saved.ok) return saved.result;
    const { job } = saved;
    invalidateCache(PUBLIC_JOBS_CACHE);
    revalidatePath("/", "layout");
    return ok({ displayId: job.displayId }, "Job updated.");
  });
}

const statusSchema = z.object({
  jobId: uuid,
  action: z.enum(["publish", "close", "archive", "reopen", "unarchive"]),
});

export async function changeJobStatusAction(values: z.input<typeof statusSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireStaffForAction();
    const parsed = statusSchema.safeParse(values);
    if (!parsed.success) return validationFailure(parsed.error);
    await changeJobStatus(ctx, parsed.data.jobId, parsed.data.action);
    invalidateCache(PUBLIC_JOBS_CACHE);
    revalidatePath("/", "layout");
    return ok(undefined, "Job status updated.");
  });
}
