import { describe, expect, it } from "vitest";
import { isJobPortalPath, isPublicAdminPath, isStaffSession, staffDestination } from "@/modules/auth/portal";

describe("portal routing", () => {
  it("recognises job-portal pages", () => {
    for (const path of ["/", "/jobs", "/jobs/MIG-JOB-000001", "/jobs/MIG-JOB-000001/apply", "/login", "/register", "/forgot-password", "/reset-password", "/privacy", "/candidate/dashboard"]) {
      expect(isJobPortalPath(path), path).toBe(true);
    }
  });

  it("leaves the admin portal, auth routes, APIs and static files alone", () => {
    for (const path of ["/admin", "/admin/jobs", "/admin/login", "/auth/confirm", "/auth/signout", "/api/admin/suggest", "/_next/data/x.json", "/robots.txt", "/brand/mig-logo.svg"]) {
      expect(isJobPortalPath(path), path).toBe(false);
    }
  });

  it("sends staff to the matching admin page", () => {
    expect(staffDestination("/")).toBe("/admin/jobs");
    expect(staffDestination("/jobs")).toBe("/admin/jobs");
    expect(staffDestination("/jobs/mig-job-000012")).toBe("/admin/jobs/MIG-JOB-000012");
    expect(staffDestination("/jobs/MIG-JOB-000012/apply")).toBe("/admin/jobs/MIG-JOB-000012");
    expect(staffDestination("/jobs/../../evil")).toBe("/admin/jobs");
    expect(staffDestination("/reset-password")).toBe("/admin/reset-password");
    expect(staffDestination("/candidate/profile")).toBe("/admin/jobs");
  });

  it("reads the staff stamp from app_metadata only", () => {
    expect(isStaffSession({ portal: "staff", provider: "email" })).toBe(true);
    expect(isStaffSession({ provider: "email" })).toBe(false);
    expect(isStaffSession(undefined)).toBe(false);
    expect(isStaffSession(null)).toBe(false);
  });

  it("keeps only the sign-in and reset-request pages open without a session", () => {
    expect(isPublicAdminPath("/admin/login")).toBe(true);
    expect(isPublicAdminPath("/admin/forgot-password")).toBe(true);
    expect(isPublicAdminPath("/admin/reset-password")).toBe(false);
    expect(isPublicAdminPath("/admin/jobs")).toBe(false);
  });
});
