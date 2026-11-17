import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";
import { isJobPortalPath, isPublicAdminPath, isStaffSession, staffDestination } from "@/modules/auth/portal";

/**
 * Refreshes the Supabase session cookie on every request and performs coarse
 * route protection. Fine-grained authorization (user type, permissions, scope)
 * is enforced on the server in pages, actions and route handlers.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims() refreshes an expired session (keeping the cookie fresh) and verifies the
  // access token's signature locally against the project's cached signing keys (ES256),
  // so navigation doesn't wait on a round trip to the Auth server. Pages, actions and
  // route handlers still confirm the user with getUser() before authorizing anything.
  let user: { sub: string; app_metadata?: unknown } | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims?.sub ? data.claims : null;
  } catch (error) {
    // A corrupted or half-written session cookie (e.g. a lost chunk) must not take the whole
    // site down: treat the visitor as signed out and drop the unreadable cookies.
    console.warn("[auth] unreadable session cookie; clearing it", error instanceof Error ? error.message : error);
    const authCookies = request.cookies.getAll().filter((c) => /^sb-.+-auth-token/.test(c.name));
    authCookies.forEach((c) => request.cookies.delete(c.name));
    response = NextResponse.next({ request });
    authCookies.forEach((c) => response.cookies.set(c.name, "", { ...sessionCookieOptions(), maxAge: 0 }));
  }

  const path = request.nextUrl.pathname;
  const isAdminArea = path.startsWith("/admin") && !isPublicAdminPath(path);
  const isCandidateArea = path.startsWith("/candidate") || /^\/jobs\/[^/]+\/apply/.test(path);

  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && (isAdminArea || isCandidateArea)) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminArea ? "/admin/login" : "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return redirectTo(url);
  }

  // Staff accounts only ever see the admin portal. Staff sign-in stamps app_metadata.portal
  // (writable only with the service-role key), so this needs no database lookup. It is a routing
  // convenience, not an authorization check; the job-portal layout repeats it against the
  // database for sessions issued before the stamp existed.
  if (isStaffSession(user?.app_metadata) && isJobPortalPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = staffDestination(path);
    url.search = "";
    return redirectTo(url);
  }

  return response;
}
