import type { ApplicationStatus, JobStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { APPLICATION_STATUS_LABELS, JOB_STATUS_LABELS } from "@/config/options";
import { candidateFacingStatus, STATUS_TONE } from "@/modules/applications/status";

export function ApplicationStatusBadge({ status, audience = "staff" }: { status: ApplicationStatus; audience?: "staff" | "candidate" }) {
  const label = audience === "candidate" ? candidateFacingStatus(status) : APPLICATION_STATUS_LABELS[status];
  return <Badge tone={STATUS_TONE[status]} dot>{label}</Badge>;
}

const JOB_TONE = { DRAFT: "muted", PUBLISHED: "success", CLOSED: "neutral", ARCHIVED: "muted" } as const;

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={JOB_TONE[status]} dot>{JOB_STATUS_LABELS[status]}</Badge>;
}
