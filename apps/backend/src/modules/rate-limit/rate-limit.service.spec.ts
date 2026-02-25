import { describe, it, expect, vi } from 'vitest'
import { RateLimitService } from './rate-limit.service'

/**
 * RateLimitService's scoring algorithms are private methods.
 * Access them via prototype to unit test the pure calculation logic
 * without needing Redis/Prisma.
 */

function createMinimalService(): RateLimitService {
  const configService = {
    get: vi.fn((key: string, fallback?: any) => fallback),
  } as any
  const prisma = {} as any

  // Bypass constructor's Redis connection
  const proto = RateLimitService.prototype
  const service = Object.create(proto)
  service.configService = configService
  service.prisma = prisma
  service.redis = { connect: vi.fn() }
  service.logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
  service.configCache = null
  service.configCacheExpiry = 0
  return service as RateLimitService
}

const svc = createMinimalService() as any

describe('RateLimitService - calculateIntervalScore', () => {
  it('returns 50 for sub-second intervals', () => {
    expect(svc.calculateIntervalScore(500)).toBe(50)
  })

  it('returns 45 for 1-2 second intervals', () => {
    expect(svc.calculateIntervalScore(1500)).toBe(45)
  })

  it('returns 35 for 2-3 second intervals', () => {
    expect(svc.calculateIntervalScore(2500)).toBe(35)
  })

  it('returns 25 for 3-5 second intervals', () => {
    expect(svc.calculateIntervalScore(4000)).toBe(25)
  })

  it('returns 15 for 5-8 second intervals', () => {
    expect(svc.calculateIntervalScore(7000)).toBe(15)
  })

  it('returns 5 for 8-15 second intervals', () => {
    expect(svc.calculateIntervalScore(10000)).toBe(5)
  })

  it('returns 0 for 15+ second intervals', () => {
    expect(svc.calculateIntervalScore(20000)).toBe(0)
  })
})

describe('RateLimitService - calculateRegularityScore', () => {
  it('returns 50 for very low CV (< 0.05)', () => {
    expect(svc.calculateRegularityScore(0.01)).toBe(50)
  })

  it('returns 45 for CV 0.05-0.10', () => {
    expect(svc.calculateRegularityScore(0.07)).toBe(45)
  })

  it('returns 40 for CV 0.10-0.15', () => {
    expect(svc.calculateRegularityScore(0.12)).toBe(40)
  })

  it('returns 30 for CV 0.15-0.25', () => {
    expect(svc.calculateRegularityScore(0.2)).toBe(30)
  })

  it('returns 20 for CV 0.25-0.40', () => {
    expect(svc.calculateRegularityScore(0.3)).toBe(20)
  })

  it('returns 10 for CV 0.40-0.60', () => {
    expect(svc.calculateRegularityScore(0.5)).toBe(10)
  })

  it('returns 5 for CV 0.60-0.80', () => {
    expect(svc.calculateRegularityScore(0.7)).toBe(5)
  })

  it('returns 0 for CV >= 0.80 (human-like randomness)', () => {
    expect(svc.calculateRegularityScore(0.9)).toBe(0)
  })
})

describe('RateLimitService - calculateRiskScore', () => {
  it('combines interval and regularity scores', () => {
    const result = svc.calculateRiskScore(500, 0.01, 50)
    expect(result.score).toBe(100) // 50 + 50
    expect(result.factors.intervalScore).toBe(50)
    expect(result.factors.regularityScore).toBe(50)
  })

  it('returns low score for slow irregular requests', () => {
    const result = svc.calculateRiskScore(20000, 0.9, 30)
    expect(result.score).toBe(0) // 0 + 0
  })

  it('returns moderate score for fast but irregular requests', () => {
    const result = svc.calculateRiskScore(500, 0.9, 20)
    expect(result.score).toBe(50) // 50 + 0
    expect(result.factors.intervalScore).toBe(50)
    expect(result.factors.regularityScore).toBe(0)
  })

  it('returns moderate score for slow but regular requests', () => {
    const result = svc.calculateRiskScore(20000, 0.01, 20)
    expect(result.score).toBe(50) // 0 + 50
    expect(result.factors.intervalScore).toBe(0)
    expect(result.factors.regularityScore).toBe(50)
  })

  it('preserves metadata fields', () => {
    const result = svc.calculateRiskScore(3000, 0.15, 25)
    expect(result.avgIntervalMs).toBe(3000)
    expect(result.cv).toBe(0.15)
    expect(result.sampleSize).toBe(25)
  })
})

describe('RateLimitService - buildKey', () => {
  it('builds user-based key when userId is present', () => {
    const key = svc.buildKey({ userId: 'u1', ipAddress: '1.2.3.4' }, 'view')
    expect(key).toBe('user:u1:view')
  })

  it('builds IP-based key when no userId', () => {
    const key = svc.buildKey({ ipAddress: '1.2.3.4' }, 'view')
    expect(key).toBe('ip:1.2.3.4:view')
  })
})

describe('RateLimitService - determineTier (legacy)', () => {
  const config = {
    softLimitPerWindow: 6,
    hardLimitPerWindow: 10,
    softLimitPerHour: 120,
    hardLimitPerHour: 200,
  } as any
  const pattern = { intervalCV: 1.0, avgInterval: null, sampleSize: 0 }

  it('returns NORMAL for low counts', () => {
    expect(svc.determineTier(1, 10, pattern, config, false)).toBe('NORMAL')
  })

  it('returns SOFT_LIMIT when window soft limit exceeded', () => {
    expect(svc.determineTier(7, 10, pattern, config, false)).toBe('SOFT_LIMIT')
  })

  it('returns HARD_LIMIT when window hard limit exceeded', () => {
    expect(svc.determineTier(11, 10, pattern, config, false)).toBe('HARD_LIMIT')
  })

  it('applies 50% stricter limits for anonymous users', () => {
    // 6 * 0.5 = 3, so 4 should exceed soft limit
    expect(svc.determineTier(4, 10, pattern, config, true)).toBe('SOFT_LIMIT')
  })

  it('returns WARNING at appropriate threshold', () => {
    // warningWindowThreshold = floor((3+5)/3) = 2 for anonymous
    expect(svc.determineTier(3, 10, pattern, config, true)).toBe('WARNING')
  })
})
