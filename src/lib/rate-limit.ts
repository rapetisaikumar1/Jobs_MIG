import "server-only";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/action-result";
import { getClientIp } from "@/lib/request";

/** `limit` applies per subject (e.g. email); `ipLimit` (default `limit`) per client IP. */
type Rule = { limit: number; windowSeconds: number; ipLimit?: number };

export const RATE_LIMITS = {
  // Counts failed sign-ins only (see checkRateLimit / recordRateLimitHit), so offices behind one IP are not locked out.
  login: { limit: 10, windowSeconds: 15 * 60, ipLimit: 50 },
  // 5 per email address; a shared office/campus IP may register many different people.
  register: { limit: 5, windowSeconds: 60 * 60, ipLimit: 30 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  // Signed-in actions: the per-user limit is the real guard. The IP limit is higher so
  // many candidates behind one office/campus IP (NAT) are not blocked by each other.
  apply: { limit: 20, windowSeconds: 60 * 60, ipLimit: 300 },
  upload: { limit: 40, windowSeconds: 60 * 60, ipLimit: 600 },
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

const TOO_MANY = "Too many attempts. Please wait a while and try again.";

async function ruleKeys(name: keyof typeof RATE_LIMITS, subject?: string) {
  const rule: Rule = RATE_LIMITS[name];
  const ip = await getClientIp();
  const keys: { key: string; limit: number }[] = [{ key: `${name}:ip:${ip}`, limit: rule.ipLimit ?? rule.limit }];
  if (subject) keys.push({ key: `${name}:sub:${subject.toLowerCase()}`, limit: rule.limit });
  return { rule, keys };
}

/** Counts this attempt and throws a user-safe error when the caller (by IP and optional subject) exceeds the rule. */
export async function enforceRateLimit(name: keyof typeof RATE_LIMITS, subject?: string): Promise<void> {
  const { rule, keys } = await ruleKeys(name, subject);
  for (const { key, limit } of keys) {
    const { allowed } = await hitRateLimit(key, { ...rule, limit });
    if (!allowed) throw new AppError(TOO_MANY);
  }
}

/** Throws if the caller is already over the limit, without counting this attempt. */
export async function checkRateLimit(name: keyof typeof RATE_LIMITS, subject?: string): Promise<void> {
  const { rule, keys } = await ruleKeys(name, subject);
  const rows = await prisma.rateLimit.findMany({ where: { key: { in: keys.map((k) => k.key) } } });
  const windowStart = Date.now() - rule.windowSeconds * 1000;
  for (const { key, limit } of keys) {
    const row = rows.find((r) => r.key === key);
    if (row && row.windowStart.getTime() >= windowStart && row.count >= limit) throw new AppError(TOO_MANY);
  }
}

/** Counts one attempt (e.g. a failed sign-in) against the rule. */
export async function recordRateLimitHit(name: keyof typeof RATE_LIMITS, subject?: string): Promise<void> {
  const { rule, keys } = await ruleKeys(name, subject);
  for (const { key, limit } of keys) await hitRateLimit(key, { ...rule, limit });
}
