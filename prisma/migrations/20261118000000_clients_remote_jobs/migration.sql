-- Clients module, remote jobs without a city / state, and the "Full-time/Contract" employment type.
-- Additive only: existing jobs, case files and applications are unchanged.

-- New employment type (existing values untouched).
ALTER TYPE "EmploymentType" ADD VALUE IF NOT EXISTS 'FULL_TIME_CONTRACT';

-- Remote jobs no longer need a city or state.
ALTER TABLE "jobs" ALTER COLUMN "state" DROP NOT NULL;
ALTER TABLE "jobs" ALTER COLUMN "city" DROP NOT NULL;

-- Clients (internal only).
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "clients_is_active_name_idx" ON "clients"("is_active", "name");
-- One client per name, ignoring case and surrounding spaces.
CREATE UNIQUE INDEX "clients_name_lower_key" ON "clients"(lower(btrim("name")));
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Same posture as every other table: no Data API access (RLS on, no policies).
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "jobs" ADD COLUMN "client_id" UUID;
CREATE INDEX "jobs_client_id_idx" ON "jobs"("client_id");
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permissions for the Clients module, granted to the built-in roles (custom roles are unchanged).
INSERT INTO "permissions" ("id", "code", "description") VALUES
    (gen_random_uuid(), 'client.view', 'See clients and the client of each job, case file and application'),
    (gen_random_uuid(), 'client.manage', 'Create, edit, deactivate and delete clients')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" IN ('client.view', 'client.manage')
WHERE r."key" IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" = 'client.view'
WHERE r."key" = 'RECRUITER'
ON CONFLICT DO NOTHING;
