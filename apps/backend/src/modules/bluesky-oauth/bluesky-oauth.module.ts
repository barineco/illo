import { Module, forwardRef } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { BlueskyOAuthController } from './bluesky-oauth.controller'
import { BlueskyOAuthService } from './bluesky-oauth.service'
import { PrismaModule } from '../prisma/prisma.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => AuthModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '10m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [BlueskyOAuthController],
  providers: [BlueskyOAuthService],
  exports: [BlueskyOAuthService],
})
export class BlueskyOAuthModule {}
