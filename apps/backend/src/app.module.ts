import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ScheduleModule } from '@nestjs/schedule'
import { APP_GUARD } from '@nestjs/core'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaModule } from './modules/prisma/prisma.module'
import { QueueModule } from './modules/queue/queue.module'
import { SetupModule } from './modules/setup/setup.module'
import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { ArtworksModule } from './modules/artworks/artworks.module'
import { LikesModule } from './modules/likes/likes.module'
import { BookmarksModule } from './modules/bookmarks/bookmarks.module'
import { FollowsModule } from './modules/follows/follows.module'
import { CommentsModule } from './modules/comments/comments.module'
import { AdminModule } from './modules/admin/admin.module'
import { FederationModule } from './modules/federation/federation.module'
import { SearchModule } from './modules/search/search.module'
import { CollectionsModule } from './modules/collections/collections.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { MessagesModule } from './modules/messages/messages.module'
import { MutesModule } from './modules/mutes/mutes.module'
import { ReportsModule } from './modules/reports/reports.module'
import { BlueskyOAuthModule } from './modules/bluesky-oauth/bluesky-oauth.module'
import { PatreonModule } from './modules/patreon/patreon.module'
import { InstanceModule } from './modules/instance/instance.module'
import { RateLimitModule } from './modules/rate-limit/rate-limit.module'
import { HeadlessDetectionModule } from './modules/headless-detection/headless-detection.module'
import { ReactionsModule } from './modules/reactions/reactions.module'
import { MlsModule } from './modules/mls/mls.module'
import { TosModule } from './modules/tos/tos.module'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    SetupModule,
    AuthModule,
    UsersModule,
    ArtworksModule,
    LikesModule,
    BookmarksModule,
    FollowsModule,
    CommentsModule,
    AdminModule,
    FederationModule,
    SearchModule,
    CollectionsModule,
    NotificationsModule,
    MessagesModule,
    MutesModule,
    ReportsModule,
    BlueskyOAuthModule,
    PatreonModule,
    InstanceModule,
    RateLimitModule,
    HeadlessDetectionModule,
    ReactionsModule,
    MlsModule,
    TosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
