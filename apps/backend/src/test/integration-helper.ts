import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../modules/prisma/prisma.service'
import { AuthService } from '../modules/auth/auth.service'
import { SessionService } from '../modules/auth/session.service'
import { MailService } from '../modules/mail/mail.service'
import { SetupService } from '../modules/setup/setup.service'
import { HttpSignatureService } from '../modules/federation/services/http-signature.service'
import { UsersService } from '../modules/users/users.service'
import { StorageService } from '../modules/storage/storage.service'
import { ActivityDeliveryService } from '../modules/federation/services/activity-delivery.service'
import { FederationSearchService } from '../modules/federation/services/federation-search.service'
import { ActorService } from '../modules/federation/services/actor.service'
import { BlueskyOAuthService } from '../modules/bluesky-oauth/bluesky-oauth.service'
import { UsersModule } from '../modules/users/users.module'
import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FederationModule } from '../modules/federation/federation.module'
import { AuthModule } from '../modules/auth/auth.module'
import { SetupModule } from '../modules/setup/setup.module'
import { StorageModule } from '../modules/storage/storage.module'

export class SpyMailService {
  calls = new Map<string, any[][]>()

  private record(method: string, args: any[]) {
    if (!this.calls.has(method)) {
      this.calls.set(method, [])
    }
    this.calls.get(method)!.push(args)
  }

  async sendVerificationEmail(...args: any[]) {
    this.record('sendVerificationEmail', args)
  }

  async sendPasswordResetEmail(...args: any[]) {
    this.record('sendPasswordResetEmail', args)
  }

  async sendEmailChangeVerification(...args: any[]) {
    this.record('sendEmailChangeVerification', args)
  }

  async sendEmailChangeNotification(...args: any[]) {
    this.record('sendEmailChangeNotification', args)
  }

  async sendNewDeviceLoginNotification(...args: any[]) {
    this.record('sendNewDeviceLoginNotification', args)
  }

  reset() {
    this.calls.clear()
  }
}

export class MockConfigService {
  get(key: string, fallback?: any) {
    return process.env[key] ?? fallback
  }
}

export class MockSetupService {
  async getInstanceInfo() {
    return {
      instanceName: 'illo-test',
      instanceUrl: 'http://localhost:3000',
      registrationOpen: true,
      requireApproval: false,
      tosVersion: 1,
    }
  }

  async isSetupComplete() {
    return true
  }

  async getPublicInstanceInfo() {
    return {
      instanceName: 'illo-test',
      allowRegistration: true,
      requireApproval: false,
    }
  }
}

export class MockHttpSignatureService {
  sign() {
    return ''
  }

  verify() {
    return true
  }

  async generateKeyPair() {
    return { publicKey: 'mock-public-key', privateKey: 'mock-private-key' }
  }
}

export class MockStorageService {
  async uploadFile() {}
  async deleteFile() {}
  async getFileUrl() {
    return ''
  }
  async getSignedUrl() {
    return ''
  }
}

export class MockActivityDeliveryService {
  async deliverActivity() {}
  async deliverToFollowers() {}
}

export class MockFederationSearchService {
  async searchRemoteUser() {
    return null
  }
  async resolveWebfinger() {
    return null
  }
}

export class MockActorService {
  async generateKeyPair() {
    return { publicKey: 'mock-public-key', privateKey: 'mock-private-key' }
  }
  async ensureUserHasKeys(userId: string) {
    return null
  }
  async getActorUrl(username: string) {
    return `http://localhost:3000/users/${username}`
  }
}

async function connectPrisma(module: TestingModule) {
  const prisma = module.get<PrismaService>(PrismaService)
  await prisma.$connect()
  return prisma
}

@Module({
  providers: [
    {
      provide: HttpSignatureService,
      useClass: MockHttpSignatureService,
    },
  ],
  exports: [HttpSignatureService],
})
class MockFederationModuleForAuth {}

@Module({
  providers: [{ provide: SetupService, useClass: MockSetupService }],
  exports: [SetupService],
})
class MockSetupModule {}

export async function createAuthTestModule() {
  const module = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
  })
    .overrideModule(FederationModule)
    .useModule(MockFederationModuleForAuth)
    .overrideModule(SetupModule)
    .useModule(MockSetupModule)
    .overrideProvider(MailService)
    .useClass(SpyMailService)
    .compile()

  const prisma = await connectPrisma(module)
  const authService = module.get<AuthService>(AuthService)
  const sessionService = module.get<SessionService>(SessionService)
  const mailService = module.get<MailService>(
    MailService,
  ) as unknown as SpyMailService

  return {
    module,
    authService,
    sessionService,
    prisma,
    mailService,
    cleanup: () => module.close(),
  }
}

@Module({
  providers: [
    {
      provide: ActivityDeliveryService,
      useClass: MockActivityDeliveryService,
    },
    {
      provide: FederationSearchService,
      useClass: MockFederationSearchService,
    },
    {
      provide: ActorService,
      useClass: MockActorService,
    },
  ],
  exports: [ActivityDeliveryService, FederationSearchService, ActorService],
})
class MockFederationModule {}

@Module({
  providers: [{ provide: StorageService, useClass: MockStorageService }],
  exports: [StorageService],
})
class MockStorageModule {}

export async function createUsersTestModule() {
  const module = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule],
  })
    .overrideModule(FederationModule)
    .useModule(MockFederationModule)
    .overrideModule(StorageModule)
    .useModule(MockStorageModule)
    .overrideProvider(MailService)
    .useClass(SpyMailService)
    .compile()

  const prisma = await connectPrisma(module)
  const usersService = module.get<UsersService>(UsersService)
  const mailService = module.get<MailService>(
    MailService,
  ) as unknown as SpyMailService

  return {
    module,
    usersService,
    prisma,
    mailService,
    cleanup: () => module.close(),
  }
}

export async function createBlueskyOAuthTestModule() {
  const configService = new MockConfigService()
  const jwtService = new JwtService({ secret: 'test-secret' })

  const module = await Test.createTestingModule({
    providers: [
      PrismaService,
      {
        provide: BlueskyOAuthService,
        useFactory: (prisma: PrismaService) => {
          const service = Object.create(BlueskyOAuthService.prototype)
          service.prisma = prisma
          service.configService = configService
          service.jwtService = jwtService
          service.instanceName = 'illo-test'
          service.logger = new Logger('BlueskyOAuthService')
          return service
        },
        inject: [PrismaService],
      },
    ],
  }).compile()

  const prisma = await connectPrisma(module)
  const blueskyOAuthService =
    module.get<BlueskyOAuthService>(BlueskyOAuthService)

  return {
    module,
    blueskyOAuthService,
    prisma,
    cleanup: () => module.close(),
  }
}

export async function truncate(prisma: PrismaService, ...tableNames: string[]) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableNames.map((t) => `"${t}"`).join(', ')} CASCADE`,
  )
}
