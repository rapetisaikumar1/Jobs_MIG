-- Permanent job deletion: an audit table and the "job.delete" permission.
-- Additive only: no existing rows are changed or removed.

-- Audit trail of deleted jobs. Keeps identifiers, counts and who deleted it — never the posting.
CREATE TABLE "job_deletions" (
    "id" UUID NOT NULL,
    "job_display_id" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "case_file_display_id" TEXT,
    "client_name" TEXT,
    "applications_deleted" INTEGER NOT NULL,
    "documents_deleted" INTEGER NOT NULL,
    "deleted_by_id" UUID,
    "deleted_by_name" TEXT NOT NULL,
    "deleted_by_email" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_deletions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_deletions_deleted_at_idx" ON "job_deletions"("deleted_at" DESC);
ALTER TABLE "job_deletions" ADD CONSTRAINT "job_deletions_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Same posture as every other table: no Data API access (RLS on, no policies).
ALTER TABLE "job_deletions" ENABLE ROW LEVEL SECURITY;

-- Permission, granted to the built-in Super Admin and Admin roles (Recruiter and custom roles unchanged).
INSERT INTO "permissions" ("id", "code", "description") VALUES
    (gen_random_uuid(), 'job.delete', 'Permanently delete jobs (with their case file and applications)')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" = 'job.delete'
WHERE r."key" IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;
