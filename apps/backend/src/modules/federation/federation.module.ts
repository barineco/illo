import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { UsersModule } from '../users/users.module'
import { MessagesModule } from '../messages/messages.module'
import { StorageModule } from '../storage/storage.module'
import { WebFingerController } from './controllers/webfinger.controller'
import { ActivityPubController } from './controllers/activitypub.controller'
import { NodeInfoController } from './controllers/nodeinfo.controller'
import { FederationImageController } from './controllers/federation-image.controller'
import { ArtworksActivityPubController } from './controllers/artworks-ap.controller'
import { WebFingerService } from './services/webfinger.service'
import { ActorService } from './services/actor.service'
import { HttpSignatureService } from './services/http-signature.service'
import { RemoteFetchService } from './services/remote-fetch.service'
import { FederationCacheService } from './services/federation-cache.service'
import { FederationSearchService } from './services/federation-search.service'
import { OutboxFetchService } from './services/outbox-fetch.service'
import { RemoteArtworkService } from './services/remote-artwork.service'
import { OutboxService } from './services/outbox.service'
import { InboxService } from './services/inbox.service'
import { ActivityDeliveryService } from './services/activity-delivery.service'
import { FollowersCollectionService } from './services/followers-collection.service'
import { ActivityDeliveryProcessor } from './processors/activity-delivery.processor'
import { RemoteImageCacheService } from './services/remote-image-cache.service'
import { RemoteAvatarCacheService } from './services/remote-avatar-cache.service'
import { RemoteImageCacheProcessor } from './processors/remote-image-cache.processor'
import { NodeInfoCheckService } from './services/nodeinfo-check.service'

@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, forwardRef(() => UsersModule), forwardRef(() => MessagesModule)],
  controllers: [
    WebFingerController,
    ActivityPubController,
    NodeInfoController,
    FederationImageController,
    ArtworksActivityPubController,
  ],
  providers: [
    WebFingerService,
    ActorService,
    HttpSignatureService,
    RemoteFetchService,
    FederationCacheService,
    FederationSearchService,
    OutboxFetchService,
    RemoteArtworkService,
    OutboxService,
    InboxService,
    ActivityDeliveryService,
    FollowersCollectionService,
    ActivityDeliveryProcessor,
    RemoteImageCacheService,
    RemoteAvatarCacheService,
    RemoteImageCacheProcessor,
    NodeInfoCheckService,
  ],
  exports: [
    WebFingerService,
    ActorService,
    HttpSignatureService,
    RemoteFetchService,
    FederationCacheService,
    FederationSearchService,
    OutboxFetchService,
    RemoteArtworkService,
    OutboxService,
    InboxService,
    ActivityDeliveryService,
    FollowersCollectionService,
    RemoteImageCacheService,
    RemoteAvatarCacheService,
    NodeInfoCheckService,
  ],
})
export class FederationModule {}
