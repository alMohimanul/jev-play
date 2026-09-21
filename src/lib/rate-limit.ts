interface Bucket {
  count: number
  windowStartMs: number
}

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000

export function checkRateLimit(ip: string, limitPerMinute?: number, nowMs: number = Date.now()): boolean {
  const limit = limitPerMinute ?? Number(process.env.RATE_LIMIT_PER_MIN ?? '10')
  const existing = buckets.get(ip)

  if (!existing || nowMs - existing.windowStartMs >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStartMs: nowMs })
    return true
  }

  if (existing.count >= limit) {
    return false
  }

  existing.count += 1
  return true
}

export function resetRateLimitsForTests(): void {
  buckets.clear()
}
