import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SupporterTier } from '@prisma/client'
import { isTierAtLeast, isSupporter } from '../constants/supporter-tiers'
import { SUPPORTER_TIER_KEY } from '../decorators/require-supporter.decorator'

/**
 * Guard that checks if the user has the required supporter tier.
 *
 * Usage:
 * - @RequireSupporter() - Requires any supporter tier (TIER_1 or above)
 * - @RequireSupporter('TIER_2') - Requires TIER_2 or above
 */
@Injectable()
export class SupporterGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTier = this.reflector.getAllAndOverride<
      SupporterTier | undefined
    >(SUPPORTER_TIER_KEY, [context.getHandler(), context.getClass()])

    // If no tier is specified via decorator, this guard shouldn't be applied
    // But if it is applied, we check for any supporter tier
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user) {
      throw new ForbiddenException('Authentication required')
    }

    const userTier: SupporterTier = user.supporterTier || 'NONE'

    // If a specific tier is required
    if (requiredTier) {
      if (!isTierAtLeast(userTier, requiredTier)) {
        throw new ForbiddenException(
          `This feature requires ${requiredTier} supporter tier or above`,
        )
      }
    } else {
      // Default: require any supporter tier
      if (!isSupporter(userTier)) {
        throw new ForbiddenException('This feature requires a supporter tier')
      }
    }

    return true
  }
}
