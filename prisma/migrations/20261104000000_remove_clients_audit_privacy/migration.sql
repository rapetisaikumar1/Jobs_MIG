-- Remove client management, the audit log and candidate privacy requests.

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_client_id_fkey";

-- DropForeignKey
ALTER TABLE "privacy_requests" DROP CONSTRAINT "privacy_requests_candidate_id_fkey";

-- DropForeignKey
ALTER TABLE "privacy_requests" DROP CONSTRAINT "privacy_requests_resolved_by_id_fkey";

-- DropIndex
DROP INDEX "jobs_client_id_idx";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "client_id";

-- DropTable
DROP TABLE "audit_logs";

-- DropTable
DROP TABLE "clients";

-- DropTable
DROP TABLE "privacy_requests";

-- DropEnum
DROP TYPE "ClientStatus";

-- DropEnum
DROP TYPE "PrivacyRequestStatus";

-- DropEnum
DROP TYPE "PrivacyRequestType";


-- Display-ID sequence for clients is no longer used.
DROP SEQUENCE IF EXISTS "client_display_seq";
