import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RateLimitService } from './rate-limit.service';
import { RATE_LIMIT_KEY } from './decorators/rate-limit.decorator';
import { RateLimitDecoratorOptions, RateLimitStatus } from './interfaces/rate-limit.interface';

// Extend Express Request to include rate limit status
declare global {
  namespace Express {
    interface Request {
      rateLimitStatus?: RateLimitStatus;
    }
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitDecoratorOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    // If no rate limit decorator, skip
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    const ipAddress = this.getClientIp(request);

    // Extract artwork ID from route params if available
    const artworkId = request.params?.id;

    // Get hasRealInteraction from headless detection result (if available)
    const headlessResult = (request as any).headlessDetectionResult;
    const hasRealInteraction = headlessResult?.signals?.userInteraction?.hasRealInteraction;

    const status = await this.rateLimitService.checkRateLimit(
      { userId: user?.id, ipAddress },
      options.action,
      artworkId,
      hasRealInteraction,
    );

    // Attach status to request for interceptor
    // Preserve existing status if it's more restrictive (e.g. from HeadlessDetectionGuard)
    const existing = request.rateLimitStatus;
    if (existing?.degradeQuality && !status.degradeQuality) {
      // Keep the more restrictive status
    } else {
      request.rateLimitStatus = status;
    }

    // Never block - just set status and let request through
    // The response will have degraded quality if needed
    return true;
  }

  private getClientIp(request: Request): string {
    // Handle proxies (X-Forwarded-For header)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips =
        typeof forwarded === 'string' ? forwarded : forwarded[0];
      return ips.split(',')[0].trim();
    }

    // Handle X-Real-IP header (common with nginx)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return typeof realIp === 'string' ? realIp : realIp[0];
    }

    // Fallback to connection IP
    return request.ip || request.socket?.remoteAddress || '0.0.0.0';
  }
}
