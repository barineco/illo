import { Module } from '@nestjs/common'
import { SearchController } from './search.controller'
import { SearchPatternService } from './services/search-pattern.service'
import { UsersModule } from '../users/users.module'
import { ArtworksModule } from '../artworks/artworks.module'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'

@Module({
  imports: [PrismaModule, UsersModule, ArtworksModule, FederationModule],
  controllers: [SearchController],
  providers: [SearchPatternService],
  exports: [SearchPatternService],
})
export class SearchModule {}
