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
import { deleteRole, saveRole } from "@/modules/access-control/admin-service";
import { addCandidateToJob, submitPortalApplication, updateApplicationStatus } from "@/modules/applications/service";
import { createInternalCandidate, updateOwnProfile } from "@/modules/candidates/service";
import { candidateSelfProfileSchema, staffCandidateSchema } from "@/modules/candidates/schemas";
import { EMPTY_STAFF_CANDIDATE, profileToFormValues } from "@/modules/candidates/form-values";
import { createUploadTicket } from "@/modules/documents/service";
import { jobSchema } from "@/modules/jobs/schemas";
import { EMPTY_JOB } from "@/modules/jobs/form-values";
import { changeJobStatus, createJob, updateJob } from "@/modules/jobs/service";
import { listPublicJobs } from "@/modules/jobs/queries";
import { parseCandidateSearch } from "@/modules/search/candidate-search";
import { searchCandidates } from "@/modules/search/service";
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
    preferredSkills: ["AWS"], country: "CA", state: "ON", city: "Toronto", minExperience: "5", maxExperience: "8", ...overrides,
  });

const candidateInput = (overrides: Record<string, unknown> = {}) =>
  staffCandidateSchema.parse({
    ...EMPTY_STAFF_CANDIDATE, firstName: "Sarah", lastName: "Wilson", email: "sarah.wilson@example.com", phone: "613-555-0102",
    country: "CA", state: "ON", city: "Ottawa", currentTitle: "Java Developer", totalExperienceYears: "7",
    primarySkills: ["Java"], secondarySkills: ["Spring Boot", "AWS"], source: "INTERNAL_RECRUITMENT", ...overrides,
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

  it("creates internal candidates who are immediately searchable, without duplicates", async () => {
    const resumeId = await upload(recruiterUser.id, null);
    const created = await createInternalCandidate(recruiter, { ...candidateInput(), documentIds: [resumeId] });
    expect(created.status).toBe("created");
    const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { email: "sarah.wilson@example.com" } });
    expect(profile.userId).toBeNull();
    expect(profile.defaultResumeId).toBe(resumeId);

    const byKeyword = await searchCandidates(recruiter, parseCandidateSearch({ q: "Java Ottawa" }), 1);
    expect(byKeyword.candidates.map((c) => c.id)).toContain(profile.id);

    await expect(createInternalCandidate(recruiter, candidateInput())).rejects.toThrow("already exists");
    const similar = await createInternalCandidate(recruiter, candidateInput({ email: "s.wilson@other.example" }));
    expect(similar.status).toBe("needs-confirmation");
  });

  it("combines advanced search filters correctly", async () => {
    await createInternalCandidate(recruiter, candidateInput({ firstName: "Junior", lastName: "Dev", email: "junior@example.com", phone: "416-555-0199", totalExperienceYears: "2" }));
    await createInternalCandidate(recruiter, candidateInput({ firstName: "US", lastName: "Dev", email: "us@example.com", phone: "212-555-0198", country: "US", state: "NY" }));
    await createInternalCandidate(recruiter, candidateInput({ firstName: "No", lastName: "Aws", email: "noaws@example.com", phone: "416-555-0197", secondarySkills: ["Spring Boot"] }));

    const result = await searchCandidates(
      recruiter,
      parseCandidateSearch({ country: "CA", primarySkills: "Java", skills: "Spring Boot, AWS", minExp: "5", maxExp: "8" }),
      1,
    );
    expect(result.candidates.map((c) => c.email).sort()).toEqual(["sarah.wilson@example.com"]);
  });

  it("adds an internal candidate to a job with consent, and keeps the snapshot after profile edits", async () => {
    const job = await createJob(admin, jobInput({ title: "Internal Add", assignedRecruiterId: recruiterUser.id }));
    const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { email: "sarah.wilson@example.com" } });

    const result = await addCandidateToJob(recruiter, {
      jobId: job.id, candidateId: candidate.id, resumeDocumentId: candidate.defaultResumeId!,
      consentBasis: "Confirmed by phone", consentConfirmed: true,
    });
    const app = await prisma.application.findUniqueOrThrow({ where: { displayId: result.displayId }, include: { folder: true, documents: true } });
    expect(app.source).toBe("INTERNAL_RECRUITMENT");
    expect(app.consentRecordedById).toBe(recruiterUser.id);
    expect(app.folder?.caseFileId).toBe(job.caseFile!.id);
    expect(app.documents[0].id).not.toBe(candidate.defaultResumeId); // separate copy

    const full = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidate.id }, include: { skills: { include: { skill: true } } } });
    await updateOwnProfile(candidate.id, candidateSelfProfileSchema.parse({ ...profileToFormValues(full), firstName: "Sara", currentTitle: "Engineering Manager" }));
    const after = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect((after.candidateSnapshot as { firstName: string; currentTitle: string }).firstName).toBe("Sarah");
    expect((after.candidateSnapshot as { currentTitle: string }).currentTitle).toBe("Java Developer");
  });

  it("records status changes with history", async () => {
    const app = await prisma.application.findFirstOrThrow({ where: { source: "INTERNAL_RECRUITMENT" } });
    await updateApplicationStatus(recruiter, { applicationId: app.id, status: "SHORTLISTED", note: "Strong match" });
    await updateApplicationStatus(recruiter, { applicationId: app.id, status: "SUBMITTED_TO_CLIENT" });
    const history = await prisma.applicationStatusHistory.findMany({ where: { applicationId: app.id }, orderBy: { changedAt: "asc" } });
    expect(history.map((h) => h.toStatus)).toEqual(["APPLIED", "SHORTLISTED", "SUBMITTED_TO_CLIENT"]);
    expect(history[1]).toMatchObject({ fromStatus: "APPLIED", changedById: recruiterUser.id, note: "Strong match" });
    await expect(updateApplicationStatus(recruiter, { applicationId: app.id, status: "SUBMITTED_TO_CLIENT" })).rejects.toThrow();
  });

  it("limits recruiters to jobs they created or are assigned to", async () => {
    const other = await createJob(admin, jobInput({ title: "Not Yours" }));
    await expect(assertJobAccess(recruiter, other.id)).rejects.toBeInstanceOf(ForbiddenError);
    const app = await prisma.application.findFirstOrThrow({ where: { job: { title: "Portal Apply" } } });
    await expect(updateApplicationStatus(recruiter, { applicationId: app.id, status: "REJECTED" })).rejects.toBeInstanceOf(ForbiddenError);

    const assigned = await createJob(admin, jobInput({ title: "Assigned Job", assignedRecruiterId: recruiterUser.id }));
    await expect(assertJobAccess(recruiter, assigned.id)).resolves.toBeUndefined();
    await expect(changeJobStatus(recruiter, assigned.id, "publish")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("deletes custom roles only when unused, never built-in roles", async () => {
    const builtIn = await prisma.role.findUniqueOrThrow({ where: { key: "RECRUITER" } });
    await expect(deleteRole(admin, builtIn.id)).rejects.toThrow("Built-in roles cannot be deleted");

    const role = await saveRole(admin, null, { name: "Temp Sourcer", permissions: ["candidate.view", "role.delete"] });
    await expect(saveRole(admin, null, { name: "temp sourcer ", permissions: ["candidate.view"] })).rejects.toThrow("already exists");
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
});
