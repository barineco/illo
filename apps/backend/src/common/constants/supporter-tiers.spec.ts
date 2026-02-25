import { describe, it, expect } from 'vitest'
import {
  TIER_LIMITS,
  getMaxImagesPerArtwork,
  getStorageQuota,
  isAnalyticsEnabled,
  isTierAtLeast,
  isSupporter,
} from './supporter-tiers'

describe('TIER_LIMITS', () => {
  it('defines limits for all tiers', () => {
    expect(TIER_LIMITS).toHaveProperty('NONE')
    expect(TIER_LIMITS).toHaveProperty('TIER_1')
    expect(TIER_LIMITS).toHaveProperty('TIER_2')
    expect(TIER_LIMITS).toHaveProperty('TIER_3')
  })
})

describe('getMaxImagesPerArtwork', () => {
  it('returns 5 for NONE', () => {
    expect(getMaxImagesPerArtwork('NONE')).toBe(5)
  })

  it('returns 20 for TIER_1', () => {
    expect(getMaxImagesPerArtwork('TIER_1')).toBe(20)
  })

  it('increases with higher tiers', () => {
    expect(getMaxImagesPerArtwork('TIER_2')).toBeGreaterThan(
      getMaxImagesPerArtwork('TIER_1'),
    )
    expect(getMaxImagesPerArtwork('TIER_3')).toBeGreaterThan(
      getMaxImagesPerArtwork('TIER_2'),
    )
  })
})

describe('getStorageQuota', () => {
  it('returns 1GB for NONE', () => {
    expect(getStorageQuota('NONE')).toBe(BigInt(1 * 1024 * 1024 * 1024))
  })

  it('increases with higher tiers', () => {
    expect(getStorageQuota('TIER_1')).toBeGreaterThan(getStorageQuota('NONE'))
    expect(getStorageQuota('TIER_3')).toBeGreaterThan(getStorageQuota('TIER_2'))
  })
})

describe('isAnalyticsEnabled', () => {
  it('is disabled for NONE', () => {
    expect(isAnalyticsEnabled('NONE')).toBe(false)
  })

  it('is enabled for all supporter tiers', () => {
    expect(isAnalyticsEnabled('TIER_1')).toBe(true)
    expect(isAnalyticsEnabled('TIER_2')).toBe(true)
    expect(isAnalyticsEnabled('TIER_3')).toBe(true)
  })
})

describe('isTierAtLeast', () => {
  it('NONE meets NONE requirement', () => {
    expect(isTierAtLeast('NONE', 'NONE')).toBe(true)
  })

  it('NONE does not meet TIER_1 requirement', () => {
    expect(isTierAtLeast('NONE', 'TIER_1')).toBe(false)
  })

  it('TIER_3 meets any requirement', () => {
    expect(isTierAtLeast('TIER_3', 'NONE')).toBe(true)
    expect(isTierAtLeast('TIER_3', 'TIER_1')).toBe(true)
    expect(isTierAtLeast('TIER_3', 'TIER_2')).toBe(true)
    expect(isTierAtLeast('TIER_3', 'TIER_3')).toBe(true)
  })

  it('same tier meets its own requirement', () => {
    expect(isTierAtLeast('TIER_2', 'TIER_2')).toBe(true)
  })

  it('lower tier does not meet higher requirement', () => {
    expect(isTierAtLeast('TIER_1', 'TIER_2')).toBe(false)
  })
})

describe('isSupporter', () => {
  it('NONE is not a supporter', () => {
    expect(isSupporter('NONE')).toBe(false)
  })

  it('all non-NONE tiers are supporters', () => {
    expect(isSupporter('TIER_1')).toBe(true)
    expect(isSupporter('TIER_2')).toBe(true)
    expect(isSupporter('TIER_3')).toBe(true)
  })
})
