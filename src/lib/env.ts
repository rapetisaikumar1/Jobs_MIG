import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Server-side configuration. Read lazily so builds don't require secrets. */
export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get documentsBucket() {
    return process.env.SUPABASE_DOCUMENTS_BUCKET ?? "candidate-documents";
  },
  get cronSecret() {
    return process.env.CRON_SECRET;
  },
  get staffSessionMaxHours() {
    return Number(process.env.STAFF_SESSION_MAX_HOURS ?? 12);
  },
  get candidateSessionMaxHours() {
    return Number(process.env.CANDIDATE_SESSION_MAX_HOURS ?? 24 * 7);
  },
};
