/** Only allow same-site relative paths as post-login redirects (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // URL parsing strips tabs/newlines and treats "\" like "/", so "/\t/evil.com" would become
  // "//evil.com". Reject control characters and backslashes outright, then resolve the path
  // and require it to stay on this origin.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  const base = "http://same.origin";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  const out = `${url.pathname}${url.search}${url.hash}`;
  // Dot segments collapse during parsing ("/.//evil.com" -> "//evil.com"), which a browser would
  // read as another host. Re-check the result, not just the input.
  if (out.startsWith("//") || out.startsWith("/\\")) return fallback;
  return out;
}
