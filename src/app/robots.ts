import type { MetadataRoute } from "next";
import { serverEnv } from "@/lib/env";

/** Public job pages may be indexed; account, admin and API routes may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/candidate", "/api", "/auth", "/login", "/register", "/forgot-password", "/reset-password"] }],
    host: serverEnv.siteUrl,
  };
}
