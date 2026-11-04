"use client";

import { ActionButton } from "@/components/forms/action-button";
import { changeJobStatusAction } from "@/modules/jobs/actions";
import type { JobStatusAction } from "@/modules/jobs/service";

const LABELS: Record<JobStatusAction, { label: string; confirm?: string; variant?: "default" | "outline" }> = {
  publish: { label: "Publish job", confirm: "Publish this job on the public job portal?", variant: "default" },
  reopen: { label: "Re-open job", confirm: "Re-open this job? Its original posted date is kept.", variant: "default" },
  close: { label: "Close job", confirm: "Close this job? It will stop accepting applications." },
  archive: { label: "Archive", confirm: "Archive this job? It will be hidden from active lists." },
  unarchive: { label: "Unarchive" },
};

export function JobStatusActions({ jobId, actions }: { jobId: string; actions: JobStatusAction[] }) {
  return (
    <>
      {actions.map((action, index) => (
        <ActionButton
          // Keyed by position so the outcome message survives the refresh that swaps the available actions.
          key={index}
          variant={LABELS[action].variant ?? "outline"}
          confirm={LABELS[action].confirm}
          action={() => changeJobStatusAction({ jobId, action })}
        >
          {LABELS[action].label}
        </ActionButton>
      ))}
    </>
  );
}
