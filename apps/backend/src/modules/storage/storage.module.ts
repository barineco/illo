import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { StorageService } from './storage.service'
import { EncryptionService } from './encryption.service'
import { ImageSigningService } from './image-signing.service'
import { ImageProxyController } from './image-proxy.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'
import { HeadlessDetectionModule } from '../headless-detection/headless-detection.module'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => FederationModule),
    HeadlessDetectionModule,
  ],
  controllers: [ImageProxyController],
  providers: [StorageService, EncryptionService, ImageSigningService],
  exports: [StorageService, EncryptionService, ImageSigningService],
})
export class StorageModule {}
