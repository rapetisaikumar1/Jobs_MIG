-- Removes the unused database objects added by 20261120000000_job_delete (the Delete Job feature
-- was removed from the application). Touches nothing else. Backup taken beforehand.

-- 1. The audit table, only if it is empty (stops the whole migration otherwise).
DO $$
BEGIN
  IF to_regclass('public.job_deletions') IS NOT NULL AND EXISTS (SELECT 1 FROM "job_deletions") THEN
    RAISE EXCEPTION 'job_deletions is not empty; refusing to drop it';
  END IF;
END $$;
DROP TABLE IF EXISTS "job_deletions";

-- 2. The job.delete permission and its grants (Super Admin and Admin).
DELETE FROM "role_permissions"
WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "code" = 'job.delete');
DELETE FROM "permissions" WHERE "code" = 'job.delete';
