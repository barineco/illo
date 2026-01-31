import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common'
import { SupporterTier } from '@prisma/client'
import { SupporterGuard } from '../guards/supporter.guard'

export const SUPPORTER_TIER_KEY = 'supporter_tier'

/**
 * Decorator to require a supporter tier for an endpoint.
 *
 * Usage:
 * - @RequireSupporter() - Requires any supporter tier (TIER_1 or above)
 * - @RequireSupporter('TIER_2') - Requires TIER_2 or above
 *
 * Note: This decorator should be used AFTER @UseGuards(JwtAuthGuard)
 * to ensure the user is authenticated first.
 *
 * @example
 * ```typescript
 * @Get('analytics')
 * @UseGuards(JwtAuthGuard)
 * @RequireSupporter()
 * async getAnalytics() {
 *   // Only supporters can access this
 * }
 *
 * @Get('premium-feature')
 * @UseGuards(JwtAuthGuard)
 * @RequireSupporter('TIER_2')
 * async getPremiumFeature() {
 *   // Only TIER_2 or TIER_3 supporters can access this
 * }
 * ```
 */
export function RequireSupporter(tier?: SupporterTier) {
  return applyDecorators(
    SetMetadata(SUPPORTER_TIER_KEY, tier || 'TIER_1'),
    UseGuards(SupporterGuard),
  )
}
