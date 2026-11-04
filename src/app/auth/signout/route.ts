import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Signs out after a session expires or an account is deactivated, then returns to the right login page. */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  // scope "local": this browser only. As a GET endpoint it can be triggered cross-site
  // (e.g. an <img> tag), which must not sign the user out on all their devices.
  await supabase.auth.signOut({ scope: "local" });
  const params = request.nextUrl.searchParams;
  const target = params.get("to") === "admin" ? "/admin/login" : "/login";
  const reason = params.has("expired") ? "?expired=1" : params.has("inactive") ? "?inactive=1" : "";
  return NextResponse.redirect(new URL(`${target}${reason}`, request.nextUrl.origin));
}
