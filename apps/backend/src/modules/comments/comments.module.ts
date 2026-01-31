import { Module, forwardRef } from '@nestjs/common'
import { CommentsController } from './comments.controller'
import { CommentsService } from './comments.service'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'
import { MutesModule } from '../mutes/mutes.module'

@Module({
  imports: [PrismaModule, forwardRef(() => FederationModule), MutesModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
