type RateLimitEntry = { count: number; resetAt: number };

const entries = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = entries.get(key);

  if (!existing || existing.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + options.windowMs });
    pruneExpiredEntries(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= options.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function getRequestClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return (
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function pruneExpiredEntries(now: number) {
  if (entries.size < 10_000) return;
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
}
