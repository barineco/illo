import { SetMetadata } from '@nestjs/common';
import { RateLimitDecoratorOptions } from '../interfaces/rate-limit.interface';

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit = (options: RateLimitDecoratorOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
