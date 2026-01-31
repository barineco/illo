import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessagesController } from './messages.controller'
import { MessagesService } from './messages.service'
import { MessageEncryptionService } from './message-encryption.service'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'

@Module({
  imports: [PrismaModule, ConfigModule, forwardRef(() => FederationModule)],
  controllers: [MessagesController],
  providers: [MessagesService, MessageEncryptionService],
  exports: [MessagesService, MessageEncryptionService],
})
export class MessagesModule {}
