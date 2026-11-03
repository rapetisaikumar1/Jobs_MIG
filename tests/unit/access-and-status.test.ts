import { describe, expect, it } from "vitest";
import { PERMISSIONS, resolvePermissions, SYSTEM_ROLES } from "@/modules/access-control/permissions";
import { candidateFacingStatus, summarizeCandidateApplications } from "@/modules/applications/status";
import { safeNextPath } from "@/modules/auth/redirects";

describe("built-in roles", () => {
  it("Super Admin has every permission", () => {
    expect(new Set(SYSTEM_ROLES.SUPER_ADMIN.permissions).size).toBe(Object.values(PERMISSIONS).length);
  });
  it("Admin cannot manage users or roles", () => {
    expect(SYSTEM_ROLES.ADMIN.permissions).not.toContain(PERMISSIONS.USER_MANAGE);
    expect(SYSTEM_ROLES.ADMIN.permissions).not.toContain(PERMISSIONS.ROLE_MANAGE);
  });
  it("Recruiter works on authorized jobs only and cannot create or publish jobs", () => {
    const p = SYSTEM_ROLES.RECRUITER.permissions;
    expect(p).toContain(PERMISSIONS.APPLICATION_UPDATE_STATUS);
    expect(p).toContain(PERMISSIONS.CANDIDATE_ADD);
    expect(p).not.toContain(PERMISSIONS.JOB_VIEW_ALL);
    expect(p).not.toContain(PERMISSIONS.JOB_CREATE);
  });
  it("ignores unknown permission codes", () => {
    expect([...resolvePermissions([["job.create", "made.up"]])]).toEqual(["job.create"]);
  });
});

describe("candidate-facing status", () => {
  it("does not reveal internal steps", () => {
    expect(candidateFacingStatus("SUBMITTED_TO_CLIENT")).toBe("Shortlisted");
    expect(candidateFacingStatus("REJECTED")).toBe("Not Selected");
  });
  it("summarizes dashboard counts", () => {
    expect(summarizeCandidateApplications(["APPLIED", "SHORTLISTED", "SUBMITTED_TO_CLIENT", "REJECTED", "SELECTED"])).toEqual({
      total: 5, active: 3, shortlisted: 2, rejected: 1,
    });
  });
});

describe("redirect safety", () => {
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", ""])("rejects %s", (next) => expect(safeNextPath(next, "/x")).toBe("/x"));
  it("keeps relative paths", () => expect(safeNextPath("/jobs/MIG-JOB-000001/apply", "/x")).toBe("/jobs/MIG-JOB-000001/apply"));
});

describe("permission catalogue", () => {
  it("every permission has a description and appears in exactly one group", async () => {
    const { ALL_PERMISSIONS, PERMISSION_DESCRIPTIONS, PERMISSION_GROUPS } = await import("@/modules/access-control/permissions");
    const grouped = PERMISSION_GROUPS.flatMap((g) => g.permissions);
    expect(grouped.sort()).toEqual([...ALL_PERMISSIONS].sort());
    for (const p of ALL_PERMISSIONS) expect(PERMISSION_DESCRIPTIONS[p]).toBeTruthy();
  });
  it("built-in Admin and Recruiter keep the actions they had", () => {
    for (const p of [PERMISSIONS.APPLICATION_CREATE, PERMISSIONS.APPLICATION_NOTE, PERMISSIONS.APPLICATION_ASSIGN, PERMISSIONS.DOCUMENT_VIEW]) {
      expect(SYSTEM_ROLES.ADMIN.permissions).toContain(p);
      expect(SYSTEM_ROLES.RECRUITER.permissions).toContain(p);
    }
  });
});

describe("role deletion permission", () => {
  it("is its own permission, granted only to Super Admin by default", () => {
    expect(SYSTEM_ROLES.SUPER_ADMIN.permissions).toContain(PERMISSIONS.ROLE_DELETE);
    expect(SYSTEM_ROLES.ADMIN.permissions).not.toContain(PERMISSIONS.ROLE_DELETE);
    expect(SYSTEM_ROLES.RECRUITER.permissions).not.toContain(PERMISSIONS.ROLE_DELETE);
  });
});
