import { SupporterTier } from '@prisma/client'

/**
 * Tier-based feature limits configuration
 *
 * NONE: Free tier (default)
 * TIER_1: Basic supporter
 * TIER_2: Advanced supporter (future)
 * TIER_3: Premium supporter (future)
 */
export const TIER_LIMITS: Record<
  SupporterTier,
  {
    maxImagesPerArtwork: number
    storageQuotaBytes: bigint
    analyticsEnabled: boolean
  }
> = {
  NONE: {
    maxImagesPerArtwork: 5,
    storageQuotaBytes: BigInt(1 * 1024 * 1024 * 1024), // 1GB
    analyticsEnabled: false,
  },
  TIER_1: {
    maxImagesPerArtwork: 20,
    storageQuotaBytes: BigInt(5 * 1024 * 1024 * 1024), // 5GB
    analyticsEnabled: true,
  },
  TIER_2: {
    maxImagesPerArtwork: 50,
    storageQuotaBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB
    analyticsEnabled: true,
  },
  TIER_3: {
    maxImagesPerArtwork: 100,
    storageQuotaBytes: BigInt(20 * 1024 * 1024 * 1024), // 20GB
    analyticsEnabled: true,
  },
}

/**
 * Get the maximum images per artwork for a given tier
 */
export function getMaxImagesPerArtwork(tier: SupporterTier): number {
  return TIER_LIMITS[tier].maxImagesPerArtwork
}

/**
 * Get the storage quota for a given tier
 */
export function getStorageQuota(tier: SupporterTier): bigint {
  return TIER_LIMITS[tier].storageQuotaBytes
}

/**
 * Check if analytics is enabled for a given tier
 */
export function isAnalyticsEnabled(tier: SupporterTier): boolean {
  return TIER_LIMITS[tier].analyticsEnabled
}

/**
 * Check if a tier is at least the required tier level
 * Tier hierarchy: NONE < TIER_1 < TIER_2 < TIER_3
 */
export function isTierAtLeast(
  userTier: SupporterTier,
  requiredTier: SupporterTier,
): boolean {
  const tierOrder: SupporterTier[] = ['NONE', 'TIER_1', 'TIER_2', 'TIER_3']
  return tierOrder.indexOf(userTier) >= tierOrder.indexOf(requiredTier)
}

/**
 * Check if a user is a supporter (any tier above NONE)
 */
export function isSupporter(tier: SupporterTier): boolean {
  return tier !== 'NONE'
}
