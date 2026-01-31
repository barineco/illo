import { Module } from '@nestjs/common'
import { ReactionsController } from './reactions.controller'
import { ReactionsService } from './reactions.service'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'
import { AnonymousReactionRateLimitGuard } from './guards/anonymous-rate-limit.guard'

@Module({
  imports: [PrismaModule, FederationModule],
  controllers: [ReactionsController],
  providers: [ReactionsService, AnonymousReactionRateLimitGuard],
  exports: [ReactionsService],
})
export class ReactionsModule {}
