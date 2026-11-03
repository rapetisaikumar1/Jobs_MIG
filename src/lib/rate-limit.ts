import "server-only";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action-result";
import { getClientIp } from "@/lib/request";

type Rule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  apply: { limit: 20, windowSeconds: 60 * 60 },
  upload: { limit: 40, windowSeconds: 60 * 60 },
} satisfies Record<string, Rule>;

/**
 * Fixed-window counter stored in Postgres. One atomic upsert per call, so it is
 * safe across serverless instances without extra infrastructure.
 */
export async function hitRateLimit(key: string, rule: Rule): Promise<{ allowed: boolean; count: number }> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds}) THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - make_interval(secs => ${rule.windowSeconds}) THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING count`;
  const count = Number(rows[0]?.count ?? 1);
  return { allowed: count <= rule.limit, count };
}

/** Throws a user-safe error when the caller (by IP and optional subject) exceeds the rule. */
export async function enforceRateLimit(name: keyof typeof RATE_LIMITS, subject?: string): Promise<void> {
  const rule = RATE_LIMITS[name];
  const ip = await getClientIp();
  const keys = [`${name}:ip:${ip}`];
  if (subject) keys.push(`${name}:sub:${subject.toLowerCase()}`);
  for (const key of keys) {
    const { allowed } = await hitRateLimit(key, rule);
    if (!allowed) throw new AppError("Too many attempts. Please wait a while and try again.");
  }
}
