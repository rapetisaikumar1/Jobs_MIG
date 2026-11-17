"use client";

import * as React from "react";
import { ActionButton } from "@/components/forms/action-button";
import type { ActionResult } from "@/lib/action-result";
import { changeJobStatusAction } from "@/modules/jobs/actions";
import type { JobStatusAction } from "@/modules/jobs/service";

const LABELS: Record<JobStatusAction, { label: string; confirm?: string; variant?: "default" | "outline" }> = {
  publish: { label: "Publish job", confirm: "Publish this job on the public job portal?", variant: "default" },
  reopen: { label: "Re-open job", confirm: "Re-open this job? Its original posted date is kept.", variant: "default" },
  close: { label: "Close job", confirm: "Close this job? It will stop accepting applications." },
  archive: { label: "Archive", confirm: "Archive this job? It will be hidden from active lists." },
  unarchive: { label: "Unarchive" },
};

/**
 * Status buttons for the job page header. The outcome message is shown on its own line under the
 * whole button row (basis-full wraps it in the header's flex-wrap row), not under one button, so
 * the buttons stay aligned with Edit / Case file.
 */
export function JobStatusActions({ jobId, actions }: { jobId: string; actions: JobStatusAction[] }) {
  // Held here (not in each button) so it survives the refresh that swaps the available actions.
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const onDone = React.useCallback((result: ActionResult<unknown>) => {
    setMessage(result.ok ? (result.message ? { ok: true, text: result.message } : null) : { ok: false, text: result.error });
  }, []);

  return (
    <>
      {actions.map((action, index) => (
        <ActionButton
          key={index}
          variant={LABELS[action].variant ?? "outline"}
          confirm={LABELS[action].confirm}
          action={() => changeJobStatusAction({ jobId, action })}
          onDone={onDone}
          hideMessage
        >
          {LABELS[action].label}
        </ActionButton>
      ))}
      {message && (
        <p role="status" className={`basis-full text-xs sm:text-right ${message.ok ? "text-success" : "text-destructive"}`}>
          {message.text}
        </p>
      )}
    </>
  );
}
