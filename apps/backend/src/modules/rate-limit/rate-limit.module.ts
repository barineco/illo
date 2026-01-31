import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitInterceptor } from './rate-limit.interceptor';
import { RateLimitController } from './rate-limit.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [RateLimitController],
  providers: [RateLimitService, RateLimitGuard, RateLimitInterceptor],
  exports: [RateLimitService, RateLimitGuard, RateLimitInterceptor],
})
export class RateLimitModule {}
