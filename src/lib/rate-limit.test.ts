import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, resetRateLimitsForTests } from './rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimitsForTests())

  it('allows requests up to the limit within the window', () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit('1.2.3.4', 3, 1000)).toBe(true)
    }
  })

  it('blocks the request once the limit is exceeded within the window', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('1.2.3.4', 3, 1000)
    expect(checkRateLimit('1.2.3.4', 3, 1500)).toBe(false)
  })

  it('resets the count once a new 60s window starts', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('1.2.3.4', 3, 1000)
    expect(checkRateLimit('1.2.3.4', 3, 1000 + 60_000)).toBe(true)
  })

  it('tracks separate IPs independently', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('1.1.1.1', 3, 1000)
    expect(checkRateLimit('2.2.2.2', 3, 1000)).toBe(true)
  })
})
