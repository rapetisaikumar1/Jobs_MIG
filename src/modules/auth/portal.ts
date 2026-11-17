// Which portal a path belongs to, and where staff are sent when they open the job portal.
// Pure module (no server-only imports) so the middleware and unit tests can use it.

/** Value stamped into a staff login's Supabase app_metadata.portal at staff sign-in. */
export const STAFF_PORTAL = "staff";

/** True when the session's app_metadata marks a staff login. */
export function isStaffSession(appMetadata: unknown): boolean {
  return (appMetadata as { portal?: unknown } | null | undefined)?.portal === STAFF_PORTAL;
}

/** Admin pages reachable without a session. */
export function isPublicAdminPath(path: string): boolean {
  return path === "/admin/login" || path.startsWith("/admin/login/") || path === "/admin/forgot-password";
}

/** Pages of the candidate-facing job portal: everything outside /admin, /auth and /api. */
export function isJobPortalPath(path: string): boolean {
  if (/\.[a-z0-9]+$/i.test(path)) return false; // static files (robots.txt, images, ...)
  return !/^\/(admin|auth|api|_next)(\/|$)/.test(path);
}

/**
 * Where a staff member who opened a job-portal page is sent instead. A shared job link
 * (/jobs/MIG-JOB-000001) opens the same job in the admin portal.
 */
export function staffDestination(path: string): string {
  const job = /^\/jobs\/(MIG-JOB-\d+)(\/apply)?\/?$/i.exec(path);
  if (job) return `/admin/jobs/${job[1].toUpperCase()}`;
  if (path === "/reset-password") return "/admin/reset-password";
  return "/admin/jobs";
}
