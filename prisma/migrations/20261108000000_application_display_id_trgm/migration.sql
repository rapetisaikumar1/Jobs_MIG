-- Trigram index so the admin applications keyword filter (Application ID "contains")
-- can combine with the candidate/job ID lookups in an index-backed OR.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "applications_display_id_trgm_idx" ON "applications" USING GIN ("display_id" gin_trgm_ops);
