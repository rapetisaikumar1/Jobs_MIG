// Application status helpers. Pure module.
import type { ApplicationStatus } from "@prisma/client";

/**
 * What candidates see. Internal steps (e.g. "Submitted to Client") are not exposed
 * verbatim; candidates only see a coarse, candidate-appropriate status.
 */
export const CANDIDATE_FACING_STATUS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  SUBMITTED_TO_CLIENT: "Shortlisted",
  INTERVIEW: "Interview",
  SELECTED: "Selected",
  REJECTED: "Not Selected",
  WITHDRAWN: "Withdrawn",
};

export function candidateFacingStatus(status: ApplicationStatus): string {
  return CANDIDATE_FACING_STATUS[status];
}

export const ACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "SUBMITTED_TO_CLIENT",
  "INTERVIEW",
];

export const SHORTLISTED_APPLICATION_STATUSES: ApplicationStatus[] = ["SHORTLISTED", "SUBMITTED_TO_CLIENT", "INTERVIEW"];

export type StatusTone = "neutral" | "info" | "progress" | "success" | "danger" | "muted";

export const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  APPLIED: "info",
  UNDER_REVIEW: "neutral",
  SHORTLISTED: "progress",
  SUBMITTED_TO_CLIENT: "progress",
  INTERVIEW: "progress",
  SELECTED: "success",
  REJECTED: "danger",
  WITHDRAWN: "muted",
};

/** Summary counts for the candidate dashboard. */
export function summarizeCandidateApplications(statuses: ApplicationStatus[]) {
  return {
    total: statuses.length,
    active: statuses.filter((s) => ACTIVE_APPLICATION_STATUSES.includes(s)).length,
    shortlisted: statuses.filter((s) => SHORTLISTED_APPLICATION_STATUSES.includes(s)).length,
    rejected: statuses.filter((s) => s === "REJECTED").length,
  };
}
