/**
 * Service-role Supabase client for command-line scripts. Node.js < 22 has no native
 * WebSocket, which supabase-js requires at construction, so the "ws" package is supplied.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

export function scriptSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}
