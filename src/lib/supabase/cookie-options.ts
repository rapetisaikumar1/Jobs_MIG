/**
 * Session cookie hardening. @supabase/ssr defaults to httpOnly: false and no Secure flag; the
 * browser never needs the session here (the only browser-side Supabase call, a signed upload,
 * carries its own token), so keep the tokens out of reach of page scripts and off plain http.
 */
export function sessionCookieOptions() {
  const https = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
  return { httpOnly: true, secure: https, sameSite: "lax" as const, path: "/" };
}
