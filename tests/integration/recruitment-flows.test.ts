/**
 * End-to-end business flows against a real PostgreSQL database (run the Prisma
 * migrations first). Supabase Storage is replaced by an in-memory fake; everything
 * else — transactions, constraints, sequences, full-text search, scoping — is real.
 *
 *   TEST_DATABASE_URL=postgresql://... npm test
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const files = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("@/modules/documents/storage", () => ({
  newStoragePath: (fileName: string, documentId = crypto.randomUUID()) => ({ documentId, path: `documents/test/${documentId}/${fileName}` }),
  createSignedUpload: async () => ({ token: "test-token" }),
  downloadObject: async (path: string) => files.get(path) ?? null,
  copyObject: async (from: string, to: string) => {
    const data = files.get(from);
    if (!data) throw new Error("missing object");
    files.set(to, data);
  },
  removeObjects: async (paths: string[]) => paths.forEach((p) => files.delete(p)),
  createSignedDownloadUrl: async (path: string) => `https://storage.test/${path}`,
}));

import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/action-result";
import type { StaffContext } from "@/modules/access-control/context";
import { resolvePermissions, SYSTEM_ROLES } from "@/modules/access-control/permissions";
import { assertJobAccess } from "@/modules/access-control/scope";
import { syncRolesAndPermissions } from "@/modules/access-control/sync";
import { deleteRole, saveRole, setStaffUserPassword, updateStaffUser } from "@/modules/access-control/admin-service";
import { assignApplicationRecruiter, submitPortalApplication, updateApplicationStatus } from "@/modules/applications/service";
import { updateOwnProfile } from "@/modules/candidates/service";
import { ensureCandidateAccount } from "@/modules/auth/provisioning";
import type { User as AuthUser } from "@supabase/supabase-js";
import { candidateSelfProfileSchema } from "@/modules/candidates/schemas";
import { profileToFormValues } from "@/modules/candidates/form-values";
import { createUploadTicket } from "@/modules/documents/service";
import { jobSchema } from "@/modules/jobs/schemas";
import { EMPTY_JOB } from "@/modules/jobs/form-values";
import { changeJobStatus, createJob, updateJob } from "@/modules/jobs/service";
import { listPublicJobs } from "@/modules/jobs/queries";
import { hitRateLimit } from "@/lib/rate-limit";

const enabled = !!process.env.TEST_DATABASE_URL;
const PDF = new TextEncoder().encode("%PDF-1.4\n% test resume\n%%EOF\n");

function ctxFor(user: User, role: keyof typeof SYSTEM_ROLES): StaffContext {
  const permissions = resolvePermissions([SYSTEM_ROLES[role].permissions]);
  return {
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    permissions, roleKeys: [role], roleNames: [SYSTEM_ROLES[role].name],
    isSuperAdmin: role === "SUPER_ADMIN", can: (p) => permissions.has(p),
  };
}

async function upload(actorUserId: string, candidateId: string | null, type: "RESUME" | "COVER_LETTER" | "SUPPORTING" = "RESUME", bytes = PDF) {
  const ticket = await createUploadTicket({ actorUserId, candidateId, type, fileName: "resume.pdf", sizeBytes: bytes.length });
  files.set(ticket.path, bytes); // the browser upload
  return ticket.documentId;
}

const jobInput = (overrides: Record<string, unknown> = {}) =>
  jobSchema.parse({
    ...EMPTY_JOB, title: "Senior Java Developer", description: "Build payment systems.", requiredSkills: ["Java", "Spring Boot"],
    preferredSkills: ["AWS"], country: "CA", states: ["ON"], city: "Toronto", minExperience: "5", maxExperience: "8", ...overrides,
  });

let admin: StaffContext;
let recruiter: StaffContext;
let recruiterUser: User;

async function makeStaff(email: string, firstName: string) {
  return prisma.user.create({ data: { id: crypto.randomUUID(), email, firstName, lastName: "Test", type: "STAFF" } });
}

async function makePortalCandidate(email: string, firstName: string) {
  const user = await prisma.user.create({ data: { id: crypto.randomUUID(), email, firstName, lastName: "Smith", type: "CANDIDATE" } });
  const profile = await prisma.candidateProfile.create({
    data: { userId: user.id, email, firstName, lastName: "Smith", phone: "+14165550101", country: "CA", source: "JOB_PORTAL", totalExperienceYears: 6 },
  });
  return { user, profile, authUser: {} as never };
}

describe.skipIf(!enabled)("recruitment flows (PostgreSQL)", () => {
  beforeAll(async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
    await syncRolesAndPermissions(prisma);
    admin = ctxFor(await makeStaff("admin@test.dev", "Admin"), "ADMIN");
    recruiterUser = await makeStaff("recruiter@test.dev", "Rita");
    recruiter = ctxFor(recruiterUser, "RECRUITER");
  });

  it("creates a case file automatically for every new job", async () => {
    const job = await createJob(admin, jobInput());
    expect(job.displayId).toMatch(/^MIG-JOB-\d{6}$/);
    expect(job.status).toBe("DRAFT");
    expect(job.caseFile?.displayId).toMatch(/^MIG-CF-\d{6}$/);
    expect(await prisma.caseFile.count({ where: { jobId: job.id } })).toBe(1);
  });

  it("publishes with a posted date that edits and re-opening never reset", async () => {
    const job = await createJob(admin, jobInput({ title: "Posted Date Check" }));
    const published = await changeJobStatus(admin, job.id, "publish");
    expect(published.publishedAt).toBeInstanceOf(Date);
    await updateJob(admin, job.id, jobInput({ title: "Posted Date Check (edited)" }));
    await changeJobStatus(admin, job.id, "close");
    const reopened = await changeJobStatus(admin, job.id, "reopen");
    expect(reopened.publishedAt?.getTime()).toBe(published.publishedAt!.getTime());

    const { jobs } = await listPublicJobs({ q: "Posted Date Check" }, 1);
    expect(jobs.map((j) => j.id)).toContain(job.id);
    expect(jobs[0]).not.toHaveProperty("internalNotes");
  });

  it("refuses to publish a job whose application deadline has passed", async () => {
    const job = await createJob(admin, jobInput({ title: "Expired Deadline" }));
    await prisma.job.update({ where: { id: job.id }, data: { applicationDeadline: new Date("2020-01-01") } });
    await expect(changeJobStatus(admin, job.id, "publish")).rejects.toThrow("deadline has passed");
    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("DRAFT");
  });

  it("generates unique IDs and one case file per job under concurrency", async () => {
    const created = await Promise.all(Array.from({ length: 15 }, (_, i) => createJob(admin, jobInput({ title: `Concurrent ${i}` }))));
    expect(new Set(created.map((j) => j.displayId)).size).toBe(15);
    expect(new Set(created.map((j) => j.caseFile!.displayId)).size).toBe(15);
  });

  it("lets a candidate apply: application folder in the job's case file, documents linked", async () => {
    const job = await createJob(admin, jobInput({ title: "Portal Apply" }));
    await changeJobStatus(admin, job.id, "publish");
    const candidate = await makePortalCandidate("john@test.dev", "John");
    const resumeId = await upload(candidate.user.id, candidate.profile.id);
    const coverId = await upload(candidate.user.id, candidate.profile.id, "COVER_LETTER");

    const result = await submitPortalApplication(candidate, {
      jobId: job.id, resumeChoice: "upload", resumeDocumentId: resumeId, saveAsDefaultResume: true,
      coverLetterDocumentId: coverId, supportingDocumentIds: [], availability: "2 weeks", confirmAccurate: true,
    });
    expect(result.displayId).toMatch(/^MIG-APP-\d{6}$/);

    const app = await prisma.application.findUniqueOrThrow({
      where: { displayId: result.displayId },
      include: { folder: true, documents: true, statusHistory: true },
    });
    expect(app.status).toBe("APPLIED");
    expect(app.folder?.caseFileId).toBe(job.caseFile!.id);
    expect(app.folder?.displayId).toMatch(/^MIG-FLD-\d{6}$/);
    expect(app.documents.map((d) => d.status)).toEqual(["ACTIVE", "ACTIVE"]);
    expect(app.documents.every((d) => d.folderId === app.folder!.id)).toBe(true);
    expect(app.statusHistory).toHaveLength(1);

    // "Save as default" made a separate profile copy, so the application's file stays immutable.
    const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidate.profile.id } });
    expect(profile.defaultResumeId).toBeTruthy();
    expect(app.documents.map((d) => d.id)).not.toContain(profile.defaultResumeId);
  });

  it("prevents duplicate applications, including concurrent double-submits", async () => {
    const job = await createJob(admin, jobInput({ title: "Duplicate Check" }));
    await changeJobStatus(admin, job.id, "publish");
    const candidate = await makePortalCandidate("dup@test.dev", "Dana");
    const submit = async () =>
      submitPortalApplication(candidate, {
        jobId: job.id, resumeChoice: "upload", resumeDocumentId: await upload(candidate.user.id, candidate.profile.id),
        saveAsDefaultResume: false, supportingDocumentIds: [], availability: "Now", confirmAccurate: true,
      });
    const results = await Promise.allSettled([submit(), submit(), submit()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof AppError)).toBe(true);
    await expect(submit()).rejects.toThrow("already applied");
    expect(await prisma.application.count({ where: { jobId: job.id } })).toBe(1);
    expect(await prisma.caseFolder.count({ where: { caseFileId: job.caseFile!.id } })).toBe(1);
  });

  it("rejects applications to draft jobs and files that are not real PDFs", async () => {
    const draft = await createJob(admin, jobInput({ title: "Still Draft" }));
    const candidate = await makePortalCandidate("draft@test.dev", "Drew");
    const base = { saveAsDefaultResume: false, supportingDocumentIds: [], availability: "Now", confirmAccurate: true as const };
    await expect(submitPortalApplication(candidate, { ...base, jobId: draft.id, resumeChoice: "upload", resumeDocumentId: await upload(candidate.user.id, candidate.profile.id) })).rejects.toThrow("no longer accepting");

    const open = await createJob(admin, jobInput({ title: "Open For Fake" }));
    await changeJobStatus(admin, open.id, "publish");
    const fake = await upload(candidate.user.id, candidate.profile.id, "RESUME", new TextEncoder().encode("MZ not a pdf"));
    await expect(submitPortalApplication(candidate, { ...base, jobId: open.id, resumeChoice: "upload", resumeDocumentId: fake })).rejects.toThrow("not a valid file");
  });

  it("keeps the application snapshot after the candidate edits their profile, and assigns no recruiter automatically", async () => {
    const job = await createJob(admin, jobInput({ title: "Snapshot Check" }));
    await changeJobStatus(admin, job.id, "publish");
    const candidate = await makePortalCandidate("sarah@test.dev", "Sarah");
    const loadProfile = () =>
      prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidate.profile.id }, include: { skills: { include: { skill: true } } } });
    await updateOwnProfile(candidate.profile.id, candidateSelfProfileSchema.parse({ ...profileToFormValues(await loadProfile()), currentTitle: "Java Developer", primarySkills: ["Java"] }));

    const result = await submitPortalApplication(candidate, {
      jobId: job.id, resumeChoice: "upload", resumeDocumentId: await upload(candidate.user.id, candidate.profile.id),
      saveAsDefaultResume: false, supportingDocumentIds: [], availability: "2 weeks", confirmAccurate: true,
    });
    const app = await prisma.application.findUniqueOrThrow({ where: { displayId: result.displayId } });
    expect(app.source).toBe("JOB_PORTAL");
    expect(app.assignedRecruiterId).toBeNull();

    await updateOwnProfile(candidate.profile.id, candidateSelfProfileSchema.parse({ ...profileToFormValues(await loadProfile()), firstName: "Sara", currentTitle: "Engineering Manager" }));
    expect((await loadProfile()).firstName).toBe("Sara");
    const after = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(after.candidateSnapshot).toMatchObject({ firstName: "Sarah", currentTitle: "Java Developer", primarySkills: ["Java"] });
  });

  it("records status changes with history (by a recruiter assigned to the application)", async () => {
    const app = await prisma.application.findFirstOrThrow({ where: { job: { title: "Snapshot Check" } } });
    await assignApplicationRecruiter(admin, app.id, recruiterUser.id);
    await updateApplicationStatus(recruiter, { applicationId: app.id, status: "SHORTLISTED", note: "Strong match" });
    await updateApplicationStatus(recruiter, { applicationId: app.id, status: "SUBMITTED_TO_CLIENT" });
    const history = await prisma.applicationStatusHistory.findMany({ where: { applicationId: app.id }, orderBy: { changedAt: "asc" } });
    expect(history.map((h) => h.toStatus)).toEqual(["APPLIED", "SHORTLISTED", "SUBMITTED_TO_CLIENT"]);
    expect(history[1]).toMatchObject({ fromStatus: "APPLIED", changedById: recruiterUser.id, note: "Strong match" });
    await expect(updateApplicationStatus(recruiter, { applicationId: app.id, status: "SUBMITTED_TO_CLIENT" })).rejects.toThrow();
  });

  it("limits recruiters to jobs they created", async () => {
    const other = await createJob(admin, jobInput({ title: "Not Yours" }));
    await expect(assertJobAccess(recruiter, other.id)).rejects.toBeInstanceOf(ForbiddenError);
    const app = await prisma.application.findFirstOrThrow({ where: { job: { title: "Portal Apply" } } });
    await expect(updateApplicationStatus(recruiter, { applicationId: app.id, status: "REJECTED" })).rejects.toBeInstanceOf(ForbiddenError);

    // Job-level recruiter assignment no longer exists: only the creator (or job.view_all) sees a job.
    const own = await createJob(admin, jobInput({ title: "Recruiter's Own Job" }));
    await prisma.job.update({ where: { id: own.id }, data: { createdById: recruiterUser.id } });
    await expect(assertJobAccess(recruiter, own.id)).resolves.toBeUndefined();
    await expect(changeJobStatus(recruiter, own.id, "publish")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("deletes custom roles only when unused, never built-in roles", async () => {
    // Role management is a Super Admin capability (role.manage / role.delete).
    const admin = ctxFor(await makeStaff("superadmin@test.dev", "Sam"), "SUPER_ADMIN");
    const builtIn = await prisma.role.findUniqueOrThrow({ where: { key: "RECRUITER" } });
    await expect(deleteRole(admin, builtIn.id)).rejects.toThrow("Built-in roles cannot be deleted");

    const role = await saveRole(admin, null, { name: "Temp Sourcer", permissions: ["application.view", "role.delete"] });
    await expect(saveRole(admin, null, { name: "temp sourcer ", permissions: ["application.view"] })).rejects.toThrow("already exists");
    expect(await prisma.role.count({ where: { name: { equals: "Temp Sourcer", mode: "insensitive" } } })).toBe(1);
    expect((await prisma.rolePermission.count({ where: { roleId: role.id } }))).toBe(2);
    await prisma.userRole.create({ data: { userId: recruiterUser.id, roleId: role.id } });
    await expect(deleteRole(admin, role.id)).rejects.toThrow("assigned to 1 user");

    await prisma.userRole.delete({ where: { userId_roleId: { userId: recruiterUser.id, roleId: role.id } } });
    const deleted = await deleteRole(admin, role.id);
    expect(deleted.name).toBe("Temp Sourcer");
    expect(await prisma.role.count({ where: { id: role.id } })).toBe(0);
    expect(await prisma.rolePermission.count({ where: { roleId: role.id } })).toBe(0);
  });

  it("rate limits with a fixed window", async () => {
    const rule = { limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await hitRateLimit("test:key", rule)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });
  it("creates a job portal candidate on first Google sign-in, and never for unverified or non-candidate sign-ups", async () => {
    const authUser = (over: Partial<AuthUser>): AuthUser =>
      ({
        id: crypto.randomUUID(), aud: "authenticated", created_at: new Date().toISOString(),
        email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, ...over,
      }) as AuthUser;

    const google = authUser({
      email: "Taylor.Reid@Gmail.com",
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: { full_name: "Taylor Morgan Reid", email_verified: true },
    });
    const user = await ensureCandidateAccount(google);
    expect(user).toMatchObject({ type: "CANDIDATE", email: "taylor.reid@gmail.com", firstName: "Taylor", lastName: "Morgan Reid" });
    const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { userId: google.id } });
    expect(profile).toMatchObject({ source: "JOB_PORTAL", country: "OTHER", phone: null });
    // Second sign-in returns the same account.
    expect((await ensureCandidateAccount(google))?.id).toBe(google.id);

    // Email sign-up still needs a verified address; other accounts are never provisioned as candidates.
    const unverified = authUser({ email: "pending@test.dev", email_confirmed_at: undefined, user_metadata: { account_type: "candidate", first_name: "P" } });
    expect(await ensureCandidateAccount(unverified)).toBeNull();
    expect(await ensureCandidateAccount(authUser({ email: "someone@test.dev", app_metadata: { provider: "email" } }))).toBeNull();

    // An existing profile without a login (e.g. added by a recruiter earlier) with the same email is linked, not duplicated.
    await prisma.candidateProfile.create({
      data: { email: "sam.lee@gmail.com", firstName: "Sam", lastName: "Lee", phone: "+14165550142", country: "CA", source: "INTERNAL_RECRUITMENT" },
    });
    const sam = authUser({ email: "sam.lee@gmail.com", app_metadata: { provider: "google", providers: ["google"] }, user_metadata: { name: "Sam Lee" } });
    await ensureCandidateAccount(sam);
    expect((await prisma.candidateProfile.findUniqueOrThrow({ where: { email: "sam.lee@gmail.com" } })).userId).toBe(sam.id);
    expect(await prisma.candidateProfile.count({ where: { email: "sam.lee@gmail.com" } })).toBe(1);
  });
  it("non-Super-Admins can only hand out permissions they hold themselves", async () => {
    // A custom "people admin" role: manages users and roles and views applications, but cannot open documents.
    const manager = await makeStaff("people.admin@test.dev", "Pat");
    const peopleRole = await prisma.role.create({ data: { name: "People admin", permissions: { create: (await prisma.permission.findMany({ where: { code: { in: ["user.manage", "role.manage", "application.view"] } } })).map((p) => ({ permissionId: p.id })) } } });
    await prisma.userRole.create({ data: { userId: manager.id, roleId: peopleRole.id } });
    const permissions = resolvePermissions([["user.manage", "role.manage", "application.view"]]);
    const ctx: StaffContext = { user: { id: manager.id, email: manager.email, firstName: manager.firstName, lastName: manager.lastName }, permissions, roleKeys: [], roleNames: ["People admin"], isSuperAdmin: false, can: (p) => permissions.has(p) };

    // Cannot create or widen a role beyond its own permissions…
    await expect(saveRole(ctx, null, { name: "Escalate", permissions: ["document.view"] })).rejects.toThrow("permissions you have yourself");
    await expect(saveRole(ctx, peopleRole.id, { name: "People admin", permissions: ["user.manage", "role.manage", "application.view", "job.view_all"] })).rejects.toThrow("permissions you have yourself");
    // …but can create a role within them.
    const viewer = await saveRole(ctx, null, { name: "Application viewer", permissions: ["application.view"] });
    expect(viewer.name).toBe("Application viewer");

    // Cannot give itself (or anyone) the built-in Admin role, nor change its own roles.
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
    await expect(updateStaffUser(ctx, { userId: manager.id, firstName: "Pat", lastName: "Lee", roleIds: [peopleRole.id, adminRole.id] })).rejects.toThrow(/own roles|permissions you have/);
    await expect(updateStaffUser(ctx, { userId: recruiterUser.id, firstName: "Rita", lastName: "Staff", roleIds: [adminRole.id] })).rejects.toThrow();
    // Cannot take over a more privileged account (the recruiter can view documents; this role can't).
    const recruiterRole = await prisma.role.findUniqueOrThrow({ where: { key: "RECRUITER" } });
    await prisma.userRole.create({ data: { userId: recruiterUser.id, roleId: recruiterRole.id } });
    await expect(setStaffUserPassword(ctx, recruiterUser.id, "Takeover12345")).rejects.toThrow("more permissions than your own");
    await prisma.userRole.delete({ where: { userId_roleId: { userId: recruiterUser.id, roleId: recruiterRole.id } } });
    // Super Admin is unaffected.
    const sa = ctxFor(await makeStaff("sa2@test.dev", "Sue"), "SUPER_ADMIN");
    await expect(saveRole(sa, viewer.id, { name: "Application viewer", permissions: ["application.view", "document.view"] })).resolves.toBeTruthy();
  });
  it("ignores permission codes removed from the catalogue that are still stored in the database", async () => {
    // e.g. the retired candidate-module codes, until the permission sync runs.
    const stale = await prisma.permission.create({ data: { code: "candidate.view", description: "Removed" } });
    const known = await prisma.permission.findUniqueOrThrow({ where: { code: "application.view" } });
    const legacy = await prisma.role.create({ data: { name: "Legacy sourcer", permissions: { create: [{ permissionId: stale.id }, { permissionId: known.id }] } } });

    // A non-Super-Admin holding application.view can assign the role: the stale code grants nothing.
    const manager = await makeStaff("legacy.manager@test.dev", "Lee");
    const permissions = resolvePermissions([["user.manage", "application.view", "candidate.view"]]);
    expect([...permissions].sort()).toEqual(["application.view", "user.manage"]);
    const ctx: StaffContext = { user: { id: manager.id, email: manager.email, firstName: manager.firstName, lastName: manager.lastName }, permissions, roleKeys: [], roleNames: ["Manager"], isSuperAdmin: false, can: (p) => permissions.has(p) };
    const target = await makeStaff("legacy.target@test.dev", "Tia");
    await expect(updateStaffUser(ctx, { userId: target.id, firstName: "Tia", lastName: "Test", roleIds: [legacy.id] })).resolves.toBeUndefined();

    // Saving the role keeps only current codes (the stale one is dropped, never re-added).
    const sa = ctxFor(await makeStaff("sa3@test.dev", "Sid"), "SUPER_ADMIN");
    await saveRole(sa, legacy.id, { name: "Legacy sourcer", permissions: ["application.view", "candidate.view"] });
    const codes = await prisma.rolePermission.findMany({ where: { roleId: legacy.id }, select: { permission: { select: { code: true } } } });
    expect(codes.map((c) => c.permission.code)).toEqual(["application.view"]);
    await prisma.permission.delete({ where: { id: stale.id } });
  });
});
