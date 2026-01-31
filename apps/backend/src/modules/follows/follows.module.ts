import { Module } from '@nestjs/common'
import { FollowsController } from './follows.controller'
import { FollowsService } from './follows.service'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'

@Module({
  imports: [PrismaModule, FederationModule],
  controllers: [FollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
