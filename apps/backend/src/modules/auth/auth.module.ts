import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AuthController } from './auth.controller'
import { SessionController } from './session.controller'
import { WebAuthnController } from './webauthn.controller'
import { AuthService } from './auth.service'
import { TwoFactorService } from './two-factor.service'
import { SessionService } from './session.service'
import { WebAuthnService } from './webauthn.service'
import { EncryptionService } from './services/encryption.service'
import { JwtStrategy } from './strategies/jwt.strategy'
import { LocalStrategy } from './strategies/local.strategy'
import { PrismaModule } from '../prisma/prisma.module'
import { SetupModule } from '../setup/setup.module'
import { MailModule } from '../mail/mail.module'
import { FederationModule } from '../federation/federation.module'

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => SetupModule),
    MailModule,
    FederationModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m', // Default expiration for access tokens
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, SessionController, WebAuthnController],
  providers: [
    AuthService,
    TwoFactorService,
    SessionService,
    WebAuthnService,
    EncryptionService,
    JwtStrategy,
    LocalStrategy,
  ],
  exports: [AuthService, WebAuthnService],
})
export class AuthModule {}
