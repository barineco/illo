import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { RateLimitTier } from '@prisma/client';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const status = request.rateLimitStatus;

    if (status) {
      // Set rate limit headers
      response.setHeader('X-RateLimit-Tier', status.tier);
      response.setHeader(
        'X-RateLimit-DegradeQuality',
        status.degradeQuality.toString(),
      );

      if (status.penaltyExpiresAt) {
        response.setHeader(
          'X-RateLimit-Reset',
          status.penaltyExpiresAt.getTime().toString(),
        );
      }

      if (status.requestsInWindow !== undefined) {
        response.setHeader(
          'X-RateLimit-Requests-Window',
          status.requestsInWindow.toString(),
        );
      }

      if (status.requestsInHour !== undefined) {
        response.setHeader(
          'X-RateLimit-Requests-Hour',
          status.requestsInHour.toString(),
        );
      }
    }

    return next.handle();
  }
}

/**
 * Helper to check if quality should be degraded based on rate limit status
 */
export function shouldDegradeQuality(request: Request): boolean {
  const status = request.rateLimitStatus;
  if (!status) return false;
  return (
    status.tier === RateLimitTier.SOFT_LIMIT ||
    status.tier === RateLimitTier.HARD_LIMIT
  );
}
