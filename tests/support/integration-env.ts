// Points Prisma at a dedicated test database before any module creates a client.
// Integration tests TRUNCATE every table, so refuse anything that looks like a hosted database.
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const host = new URL(url).hostname;
  if (/supabase|pooler/.test(host) && process.env.ALLOW_REMOTE_TEST_DB !== "1") {
    throw new Error(`Refusing to run destructive integration tests against ${host}. Use a disposable database.`);
  }
  const dev = process.env.DATABASE_URL;
  if (dev && dev.replace(/\?.*$/, "") === url.replace(/\?.*$/, "")) {
    throw new Error("TEST_DATABASE_URL points at the development database (DATABASE_URL). Use a separate, disposable database.");
  }
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
