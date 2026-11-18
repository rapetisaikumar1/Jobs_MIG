import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Blocks framing, plugins, base-tag hijack, off-site form posts and scripts from other origins.
  // Next.js needs inline scripts ('unsafe-inline'; a nonce-based policy would be the next step).
  // script-src is production-only because the dev server's fast refresh needs eval.
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      ...(process.env.NODE_ENV === "production" ? ["script-src 'self' 'unsafe-inline'"] : []),
    ].join("; "),
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Render <title>/<meta> in the document head for every visitor instead of streaming them into
  // the body after the page. Streamed metadata intermittently tripped a React hydration error
  // (#418) on the job portal; the job pages' metadata is cheap (cached job lookup), so waiting
  // for it costs nothing noticeable. Also gives every crawler and link preview the full head.
  htmlLimitedBots: /.*/,
  devIndicators: { position: "bottom-right" },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
