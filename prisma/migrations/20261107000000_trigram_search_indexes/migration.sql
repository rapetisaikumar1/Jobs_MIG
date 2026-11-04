-- Trigram indexes so case-insensitive "contains" searches (ILIKE '%q%') on
-- candidate name/email/ID and job title can use an index instead of a full scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "jobs_title_trgm_idx" ON "jobs" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "candidate_profiles_first_name_trgm_idx" ON "candidate_profiles" USING GIN ("first_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "candidate_profiles_last_name_trgm_idx" ON "candidate_profiles" USING GIN ("last_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "candidate_profiles_email_trgm_idx" ON "candidate_profiles" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "candidate_profiles_display_id_trgm_idx" ON "candidate_profiles" USING GIN ("display_id" gin_trgm_ops);
