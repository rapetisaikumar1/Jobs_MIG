import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";

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
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const path = request.nextUrl.pathname;
  const isAdminArea = path.startsWith("/admin") && !path.startsWith("/admin/login");
  const isCandidateArea = path.startsWith("/candidate") || /^\/jobs\/[^/]+\/apply/.test(path);

  if (!user && (isAdminArea || isCandidateArea)) {
    const url = request.nextUrl.clone();
    url.pathname = isAdminArea ? "/admin/login" : "/login";
    url.search = "";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
