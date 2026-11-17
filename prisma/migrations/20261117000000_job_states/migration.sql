-- Jobs can be open in several states / provinces. Additive and backward compatible: the existing
-- "state" column is kept and still holds the first selected state, so code that reads only
-- "state" keeps working. Existing rows are backfilled with their single state.

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "states" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill
UPDATE "jobs" SET "states" = ARRAY["state"] WHERE cardinality("states") = 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_states_idx" ON "jobs" USING GIN ("states");
