-- Defence in depth (Supabase security advisor): Prisma's bookkeeping table had RLS off. API roles
-- already have no grants on it; enabling RLS (no policies) makes that explicit. The table owner
-- (used by Prisma Migrate) bypasses RLS, so migrations are unaffected.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
