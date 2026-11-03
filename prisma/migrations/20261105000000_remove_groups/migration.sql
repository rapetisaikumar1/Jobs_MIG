-- Remove recruitment groups (staff groups and job-group access). Job access is now by
-- role (job.view_all), the job creator, or the assigned recruiter.

-- DropForeignKey
ALTER TABLE "job_groups" DROP CONSTRAINT "job_groups_group_id_fkey";

-- DropForeignKey
ALTER TABLE "job_groups" DROP CONSTRAINT "job_groups_job_id_fkey";

-- DropForeignKey
ALTER TABLE "user_groups" DROP CONSTRAINT "user_groups_group_id_fkey";

-- DropForeignKey
ALTER TABLE "user_groups" DROP CONSTRAINT "user_groups_user_id_fkey";

-- DropTable
DROP TABLE "groups";

-- DropTable
DROP TABLE "job_groups";

-- DropTable
DROP TABLE "user_groups";

