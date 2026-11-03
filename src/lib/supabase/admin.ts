import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let adminClient: SupabaseClient | undefined;

/**
 * Service-role client. Bypasses RLS and storage policies — server use only,
 * after the caller has been authorized. Never import from client components.
 */
export function supabaseAdmin(): SupabaseClient {
  adminClient ??= createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
