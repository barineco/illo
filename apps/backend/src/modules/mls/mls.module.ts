import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'
import { MlsService } from './mls.service'
import { MlsController } from './mls.controller'

/**
 * MLS Module
 *
 * Handles MLS (Messaging Layer Security) key management for E2E encrypted DMs.
 * Implements RFC 9420 (MLS Protocol) and MLS over ActivityPub specification.
 *
 * @see https://datatracker.ietf.org/doc/rfc9420/
 * @see https://swicg.github.io/activitypub-e2ee/mls.html
 */
@Module({
  imports: [ConfigModule, PrismaModule, forwardRef(() => FederationModule)],
  controllers: [MlsController],
  providers: [MlsService],
  exports: [MlsService],
})
export class MlsModule {}
