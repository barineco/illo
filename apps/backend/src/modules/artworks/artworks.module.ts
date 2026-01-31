import { Module, forwardRef } from '@nestjs/common'
import { ArtworksController } from './artworks.controller'
import { ArtworksService } from './artworks.service'
import { PrismaModule } from '../prisma/prisma.module'
import { StorageModule } from '../storage/storage.module'
import { FederationModule } from '../federation/federation.module'
import { MutesModule } from '../mutes/mutes.module'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [PrismaModule, StorageModule, FederationModule, forwardRef(() => MutesModule), forwardRef(() => UsersModule)],
  controllers: [ArtworksController],
  providers: [ArtworksService],
  exports: [ArtworksService],
})
export class ArtworksModule {}
