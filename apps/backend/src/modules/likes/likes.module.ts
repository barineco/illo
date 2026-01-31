import { Module } from '@nestjs/common'
import { LikesController } from './likes.controller'
import { LikesService } from './likes.service'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'

@Module({
  imports: [PrismaModule, FederationModule],
  controllers: [LikesController],
  providers: [LikesService],
  exports: [LikesService],
})
export class LikesModule {}
