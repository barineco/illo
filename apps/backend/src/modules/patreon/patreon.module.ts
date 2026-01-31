import { Module } from '@nestjs/common'
import { PatreonController } from './patreon.controller'
import { PatreonService } from './patreon.service'
import { PrismaModule } from '../prisma/prisma.module'
import { EncryptionService } from '../auth/services/encryption.service'

@Module({
  imports: [PrismaModule],
  controllers: [PatreonController],
  providers: [PatreonService, EncryptionService],
  exports: [PatreonService],
})
export class PatreonModule {}
