-- MaverickInnogarage initial schema.

-- ---------------------------------------------------------------------------
-- Human-readable display IDs (MIG-JOB-000001, ...).
-- Backed by sequences so concurrent inserts can never collide. Numbers are
-- zero-padded to 6 digits and grow naturally beyond 999999 (lpad would truncate).
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS "client_display_seq";
CREATE SEQUENCE IF NOT EXISTS "job_display_seq";
CREATE SEQUENCE IF NOT EXISTS "candidate_display_seq";
CREATE SEQUENCE IF NOT EXISTS "application_display_seq";
CREATE SEQUENCE IF NOT EXISTS "case_file_display_seq";
CREATE SEQUENCE IF NOT EXISTS "case_folder_display_seq";

CREATE OR REPLACE FUNCTION mig_next_display_id(prefix text, seq regclass)
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT prefix || lpad(n::text, greatest(6, length(n::text)), '0')
  FROM (SELECT nextval(seq) AS n) AS s
$$;


-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('STAFF', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "Country" AS ENUM ('US', 'CA', 'OTHER');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'CAD');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('ANNUAL', 'HOURLY');

-- CreateEnum
CREATE TYPE "WorkArrangement" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'CONTRACT', 'PART_TIME');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('JOB_PORTAL', 'INTERNAL_RECRUITMENT', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'SUBMITTED_TO_CLIENT', 'INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "Qualification" AS ENUM ('HIGH_SCHOOL', 'DIPLOMA', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkAuthorizationStatus" AS ENUM ('CITIZEN', 'PERMANENT_RESIDENT', 'WORK_PERMIT', 'REQUIRES_SPONSORSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "CandidateSkillLevel" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "JobSkillType" AS ENUM ('REQUIRED', 'PREFERRED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RESUME', 'COVER_LETTER', 'SUPPORTING');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'DELETION');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "type" "UserType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("user_id","group_id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "display_id" TEXT NOT NULL DEFAULT mig_next_display_id('MIG-CLI-'::text, 'client_display_seq'::regclass),
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "country" "Country" NOT NULL,
    "notes" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "show_publicly" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "display_id" TEXT NOT NULL DEFAULT mig_next_display_id('MIG-JOB-'::text, 'job_display_seq'::regclass),
    "client_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT,
    "min_experience" INTEGER,
    "max_experience" INTEGER,
    "education" TEXT,
    "country" "Country" NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "work_arrangement" "WorkArrangement" NOT NULL,
    "employment_type" "EmploymentType" NOT NULL,
    "compensation_min" DECIMAL(12,2),
    "compensation_max" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "compensation_type" "CompensationType" NOT NULL DEFAULT 'ANNUAL',
    "salary_public" BOOLEAN NOT NULL DEFAULT false,
    "application_deadline" DATE,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "assigned_recruiter_id" UUID,
    "internal_notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_groups" (
    "job_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,

    CONSTRAINT "job_groups_pkey" PRIMARY KEY ("job_id","group_id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_skills" (
    "job_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "type" "JobSkillType" NOT NULL,

    CONSTRAINT "job_skills_pkey" PRIMARY KEY ("job_id","skill_id")
);

-- CreateTable
CREATE TABLE "candidate_profiles" (
    "id" UUID NOT NULL,
    "display_id" TEXT NOT NULL DEFAULT mig_next_display_id('MIG-CAN-'::text, 'candidate_display_seq'::regclass),
    "user_id" UUID,
    "source" "Source" NOT NULL DEFAULT 'JOB_PORTAL',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "alternate_phone" TEXT,
    "country" "Country" NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "linkedin_url" TEXT,
    "professional_title" TEXT,
    "current_title" TEXT,
    "current_employer" TEXT,
    "total_experience_years" DOUBLE PRECISION,
    "relevant_experience_years" DOUBLE PRECISION,
    "highest_qualification" "Qualification",
    "education" TEXT,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_job_titles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferred_work_arrangements" "WorkArrangement"[] DEFAULT ARRAY[]::"WorkArrangement"[],
    "preferred_employment_types" "EmploymentType"[] DEFAULT ARRAY[]::"EmploymentType"[],
    "expected_compensation" DECIMAL(12,2),
    "compensation_type" "CompensationType",
    "currency" "Currency",
    "notice_period_days" INTEGER,
    "available_from" DATE,
    "work_auth_country" "Country",
    "work_auth_status" "WorkAuthorizationStatus",
    "profile_owner_id" UUID,
    "internal_notes" TEXT,
    "created_by_id" UUID,
    "default_resume_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "search_vector" tsvector,

    CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_skills" (
    "candidate_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "level" "CandidateSkillLevel" NOT NULL,

    CONSTRAINT "candidate_skills_pkey" PRIMARY KEY ("candidate_id","skill_id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "display_id" TEXT NOT NULL DEFAULT mig_next_display_id('MIG-APP-'::text, 'application_display_seq'::regclass),
    "candidate_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "source" "Source" NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relevant_experience_years" DOUBLE PRECISION,
    "relevant_experience_summary" TEXT,
    "availability" TEXT,
    "work_authorization_response" TEXT,
    "additional_comments" TEXT,
    "assigned_recruiter_id" UUID,
    "consent_basis" TEXT,
    "consent_recorded_at" TIMESTAMPTZ(3),
    "consent_recorded_by_id" UUID,
    "candidate_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_files" (
    "id" UUID NOT NULL,
    "display_id" TEXT NOT NULL DEFAULT mig_next_display_id('MIG-CF-'::text, 'case_file_display_seq'::regclass),
    "job_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_folders" (
    "id" UUID NOT NULL,
    "display_id" TEXT NOT NULL DEFAULT mig_next_display_id('MIG-FLD-'::text, 'case_folder_display_seq'::regclass),
    "case_file_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "candidate_id" UUID,
    "application_id" UUID,
    "folder_id" UUID,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "changed_by_id" UUID,
    "note" TEXT,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_notes" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_requests" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "type" "PrivacyRequestType" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_by_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_type_is_active_idx" ON "users"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "groups"("name");

-- CreateIndex
CREATE INDEX "user_groups_group_id_idx" ON "user_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_display_id_key" ON "clients"("display_id");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_display_id_key" ON "jobs"("display_id");

-- CreateIndex
CREATE INDEX "jobs_status_published_at_idx" ON "jobs"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "jobs_client_id_idx" ON "jobs"("client_id");

-- CreateIndex
CREATE INDEX "jobs_assigned_recruiter_id_idx" ON "jobs"("assigned_recruiter_id");

-- CreateIndex
CREATE INDEX "jobs_country_state_idx" ON "jobs"("country", "state");

-- CreateIndex
CREATE INDEX "jobs_work_arrangement_idx" ON "jobs"("work_arrangement");

-- CreateIndex
CREATE INDEX "jobs_employment_type_idx" ON "jobs"("employment_type");

-- CreateIndex
CREATE INDEX "job_groups_group_id_idx" ON "job_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- CreateIndex
CREATE INDEX "job_skills_skill_id_idx" ON "job_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profiles_display_id_key" ON "candidate_profiles"("display_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profiles_user_id_key" ON "candidate_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profiles_email_key" ON "candidate_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profiles_default_resume_id_key" ON "candidate_profiles"("default_resume_id");

-- CreateIndex
CREATE INDEX "candidate_profiles_country_state_city_idx" ON "candidate_profiles"("country", "state", "city");

-- CreateIndex
CREATE INDEX "candidate_profiles_source_idx" ON "candidate_profiles"("source");

-- CreateIndex
CREATE INDEX "candidate_profiles_total_experience_years_idx" ON "candidate_profiles"("total_experience_years");

-- CreateIndex
CREATE INDEX "candidate_profiles_phone_idx" ON "candidate_profiles"("phone");

-- CreateIndex
CREATE INDEX "candidate_profiles_updated_at_idx" ON "candidate_profiles"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "candidate_profiles_search_vector_idx" ON "candidate_profiles" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "candidate_skills_skill_id_level_idx" ON "candidate_skills"("skill_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "applications_display_id_key" ON "applications"("display_id");

-- CreateIndex
CREATE INDEX "applications_job_id_status_idx" ON "applications"("job_id", "status");

-- CreateIndex
CREATE INDEX "applications_status_applied_at_idx" ON "applications"("status", "applied_at" DESC);

-- CreateIndex
CREATE INDEX "applications_applied_at_idx" ON "applications"("applied_at" DESC);

-- CreateIndex
CREATE INDEX "applications_assigned_recruiter_id_idx" ON "applications"("assigned_recruiter_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_candidate_id_job_id_key" ON "applications"("candidate_id", "job_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_files_display_id_key" ON "case_files"("display_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_files_job_id_key" ON "case_files"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_folders_display_id_key" ON "case_folders"("display_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_folders_application_id_key" ON "case_folders"("application_id");

-- CreateIndex
CREATE INDEX "case_folders_case_file_id_idx" ON "case_folders"("case_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_path_key" ON "documents"("storage_path");

-- CreateIndex
CREATE INDEX "documents_candidate_id_status_idx" ON "documents"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "documents_folder_id_idx" ON "documents"("folder_id");

-- CreateIndex
CREATE INDEX "documents_application_id_idx" ON "documents"("application_id");

-- CreateIndex
CREATE INDEX "documents_status_created_at_idx" ON "documents"("status", "created_at");

-- CreateIndex
CREATE INDEX "application_status_history_application_id_changed_at_idx" ON "application_status_history"("application_id", "changed_at");

-- CreateIndex
CREATE INDEX "application_notes_application_id_created_at_idx" ON "application_notes"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "privacy_requests_status_created_at_idx" ON "privacy_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_recruiter_id_fkey" FOREIGN KEY ("assigned_recruiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_groups" ADD CONSTRAINT "job_groups_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_groups" ADD CONSTRAINT "job_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_profile_owner_id_fkey" FOREIGN KEY ("profile_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_default_resume_id_fkey" FOREIGN KEY ("default_resume_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_recruiter_id_fkey" FOREIGN KEY ("assigned_recruiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_consent_recorded_by_id_fkey" FOREIGN KEY ("consent_recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_files" ADD CONSTRAINT "case_files_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_folders" ADD CONSTRAINT "case_folders_case_file_id_fkey" FOREIGN KEY ("case_file_id") REFERENCES "case_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_folders" ADD CONSTRAINT "case_folders_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "case_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_requests" ADD CONSTRAINT "privacy_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Supabase exposes the public schema through its REST API. The application
-- reads and writes exclusively through Prisma on the server, so enable Row Level
-- Security with no policies: anon/authenticated API keys get no access at all.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','roles','permissions','role_permissions','user_roles','groups','user_groups',
    'clients','jobs','job_groups','skills','job_skills','candidate_profiles','candidate_skills',
    'applications','case_files','case_folders','documents','application_status_history',
    'application_notes','audit_logs','privacy_requests','rate_limits'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE EXECUTE ON FUNCTION mig_next_display_id(text, regclass) FROM anon, authenticated, public;
  END IF;
END $$;
