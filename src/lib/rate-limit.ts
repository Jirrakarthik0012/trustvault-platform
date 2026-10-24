import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const policies = {
  register: { requests: 5, window: "1 h" },
  "login-ip": { requests: 20, window: "15 m" },
  "login-account": { requests: 8, window: "15 m" },
  upload: { requests: 10, window: "10 m" },
  "upload-finalize": { requests: 20, window: "10 m" }
} as const;

type Policy = keyof typeof policies;
type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "limited" | "unavailable" };

const limiters = new Map<Policy, Ratelimit>();

function getLimiter(policy: Policy) {
  const existing = limiters.get(policy);
  if (existing) return existing;
  const config = policies[policy];
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    analytics: false,
    prefix: `trustvault:${policy}`
  });
  limiters.set(policy, limiter);
  return limiter;
}

export async function checkRateLimit(
  policy: Policy,
  identifiers: string[]
): Promise<RateLimitResult> {
  const hasRedisConfig =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!hasRedisConfig) {
    if (process.env.NODE_ENV !== "production") return { allowed: true };
    console.error("TrustVault rate limiting is unavailable: Upstash credentials are missing.");
    return { allowed: false, reason: "unavailable" };
  }

  try {
    const limiter = getLimiter(policy);
    for (const identifier of identifiers) {
      const digest = createHash("sha256").update(identifier.slice(0, 512)).digest("hex");
      const result = await limiter.limit(digest);
      if (!result.success) return { allowed: false, reason: "limited" };
    }
    return { allowed: true };
  } catch (error) {
    console.error("TrustVault rate-limit check failed.", error);
    return { allowed: false, reason: "unavailable" };
  }
}
