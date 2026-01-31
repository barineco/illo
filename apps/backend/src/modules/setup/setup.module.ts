import { Module, NestModule, MiddlewareConsumer, forwardRef } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SetupController } from './setup.controller'
import { SetupService } from './setup.service'
import { SetupRedirectMiddleware } from './middleware/setup-redirect.middleware'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'

@Module({
  imports: [PrismaModule, ConfigModule, forwardRef(() => FederationModule)],
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SetupRedirectMiddleware).forRoutes('*')
  }
}
