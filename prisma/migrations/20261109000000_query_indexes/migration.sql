-- Indexes for the scoped job filter, list sort orders, applications per job / per recruiter / by source,
-- and trigram (substring) search on phone numbers, titles and IDs. Additive only: no data changes.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "applications_job_id_applied_at_idx" ON "applications"("job_id", "applied_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "applications_assigned_recruiter_id_applied_at_idx" ON "applications"("assigned_recruiter_id", "applied_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "applications_source_applied_at_idx" ON "applications"("source", "applied_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidate_profiles_created_at_idx" ON "candidate_profiles"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidate_profiles_last_name_first_name_idx" ON "candidate_profiles"("last_name", "first_name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidate_profiles_phone_trgm_idx" ON "candidate_profiles" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidate_profiles_alternate_phone_trgm_idx" ON "candidate_profiles" USING GIN ("alternate_phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidate_profiles_current_title_trgm_idx" ON "candidate_profiles" USING GIN ("current_title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidate_profiles_professional_title_trgm_idx" ON "candidate_profiles" USING GIN ("professional_title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "case_files_created_at_idx" ON "case_files"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "case_files_display_id_trgm_idx" ON "case_files" USING GIN ("display_id" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "case_folders_case_file_id_created_at_idx" ON "case_folders"("case_file_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_created_by_id_idx" ON "jobs"("created_by_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_created_at_idx" ON "jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_display_id_trgm_idx" ON "jobs" USING GIN ("display_id" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_city_trgm_idx" ON "jobs" USING GIN ("city" gin_trgm_ops);


-- Defence in depth: RLS is on and anon/authenticated grants were revoked for every existing table,
-- but Supabase's default privileges would grant future tables to those API roles. Revoke by default.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
