import { PrismaService } from '../prisma/prisma.service'
import { AuthService } from './auth.service'
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import {
  createAuthTestModule,
  SpyMailService,
  truncate,
} from '../../test/integration-helper'
import {
  DEFAULT_TEST_PASSWORD,
  createTestUser,
  createTestOAuthUser,
} from '../../test/fixtures'

describe('AuthService (integration)', () => {
  let authService: AuthService
  let prisma: PrismaService
  let mailService: SpyMailService
  let cleanup: () => Promise<void>

  beforeAll(async () => {
    const ctx = await createAuthTestModule()
    authService = ctx.authService
    prisma = ctx.prisma
    mailService = ctx.mailService
    cleanup = ctx.cleanup
  })

  beforeEach(async () => {
    await truncate(prisma, 'sessions', 'users', 'instance_settings')
    await prisma.instanceSettings.create({
      data: {
        id: 'test-instance',
        instanceName: 'illo-test',
        isSetupComplete: true,
        allowRegistration: true,
        requireApproval: false,
        tosVersion: 1,
      },
    })
    mailService.reset()
  })

  afterAll(async () => {
    await cleanup()
  })

  describe('register', () => {
    it('メールとパスワードで登録 → hasSetPassword === true', async () => {
      const result = await authService.register({
        username: 'newuser',
        email: 'newuser@test.example.com',
        password: 'StrongPass1!',
        tosAccepted: true,
      })

      expect(result.user.username).toBe('newuser')
      expect(result.user.email).toBe('newuser@test.example.com')
      expect(result.message).toBeDefined()

      const dbUser = await prisma.user.findUnique({
        where: { email: 'newuser@test.example.com' },
      })
      expect(dbUser).not.toBeNull()
      expect(dbUser!.hasSetPassword).toBe(true)

      const calls = mailService.calls.get('sendVerificationEmail')
      expect(calls).toBeDefined()
      expect(calls!.length).toBe(1)
      expect(calls![0][0]).toBe('newuser@test.example.com')
      expect(calls![0][1]).toBe('newuser')
    })

    it('重複メールで登録 → ConflictException', async () => {
      await createTestUser(prisma, {
        email: 'dup@test.example.com',
      })

      await expect(
        authService.register({
          username: 'another',
          email: 'dup@test.example.com',
          password: 'StrongPass1!',
          tosAccepted: true,
        }),
      ).rejects.toThrow(ConflictException)
    })

    it('重複ユーザー名で登録 → ConflictException', async () => {
      await createTestUser(prisma, {
        username: 'taken',
      })

      await expect(
        authService.register({
          username: 'taken',
          email: 'unique@test.example.com',
          password: 'StrongPass1!',
          tosAccepted: true,
        }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('login', () => {
    beforeEach(async () => {
      await createTestUser(prisma, {
        username: 'loginuser',
        email: 'login@test.example.com',
      })
    })

    it('正しい認証情報でログイン → アクセストークン + リフレッシュトークン返却', async () => {
      const result = await authService.login({
        email: 'login@test.example.com',
        password: DEFAULT_TEST_PASSWORD,
      })

      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      expect(result.user.email).toBe('login@test.example.com')
    })

    it('誤ったパスワード → UnauthorizedException', async () => {
      await expect(
        authService.login({
          email: 'login@test.example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('存在しないメール → UnauthorizedException', async () => {
      await expect(
        authService.login({
          email: 'nobody@test.example.com',
          password: DEFAULT_TEST_PASSWORD,
        }),
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('changePassword', () => {
    let userId: string

    beforeEach(async () => {
      const user = await createTestUser(prisma, {
        username: 'chpwuser',
        email: 'chpw@test.example.com',
      })
      userId = user.id
    })

    it('正しい現在パスワードで変更 → 成功', async () => {
      const result = await authService.changePassword(
        userId,
        DEFAULT_TEST_PASSWORD,
        'NewPassword456!',
      )

      expect(result.message).toBe('Password changed successfully')
    })

    it('誤った現在パスワード → UnauthorizedException', async () => {
      await expect(
        authService.changePassword(userId, 'WrongCurrent!', 'NewPassword456!'),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('同じパスワードに変更 → ConflictException', async () => {
      await expect(
        authService.changePassword(
          userId,
          DEFAULT_TEST_PASSWORD,
          DEFAULT_TEST_PASSWORD,
        ),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe('setPassword', () => {
    let oauthUserId: string

    beforeEach(async () => {
      const user = await createTestOAuthUser(prisma)
      oauthUserId = user.id
    })

    it(
      'hasSetPassword === false → パスワード設定成功、' +
        'hasSetPassword === true に更新',
      async () => {
        const result = await authService.setPassword(
          oauthUserId,
          'NewPassword123!',
        )

        expect(result.message).toBe('Password set successfully')

        const dbUser = await prisma.user.findUnique({
          where: { id: oauthUserId },
        })
        expect(dbUser!.hasSetPassword).toBe(true)
      },
    )

    it('hasSetPassword === true → BadRequestException', async () => {
      await authService.setPassword(oauthUserId, 'FirstPassword!')

      await expect(
        authService.setPassword(oauthUserId, 'SecondPassword!'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('forgotPassword / resetPassword', () => {
    let userEmail: string

    beforeEach(async () => {
      const user = await createTestUser(prisma, {
        username: 'resetuser',
        email: 'reset@test.example.com',
      })
      userEmail = user.email!
    })

    it('トークン発行 → リセット成功、hasSetPassword === true', async () => {
      await authService.forgotPassword(userEmail)

      const calls = mailService.calls.get('sendPasswordResetEmail')
      expect(calls).toBeDefined()
      const token = calls![0][2]

      const result = await authService.resetPassword(token, 'ResetNewPass1!')
      expect(result.message).toBe('Password reset successfully')

      const dbUser = await prisma.user.findUnique({
        where: { email: userEmail },
      })
      expect(dbUser!.hasSetPassword).toBe(true)
      expect(dbUser!.resetPasswordToken).toBeNull()
    })

    it('期限切れトークン → UnauthorizedException', async () => {
      await authService.forgotPassword(userEmail)

      const calls = mailService.calls.get('sendPasswordResetEmail')
      const token = calls![0][2]

      await prisma.user.update({
        where: { email: userEmail },
        data: {
          resetPasswordExpires: new Date(Date.now() - 1000),
        },
      })

      await expect(
        authService.resetPassword(token, 'NewPass1!'),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('無効なトークン → UnauthorizedException', async () => {
      await expect(
        authService.resetPassword('invalid-token', 'NewPass1!'),
      ).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('verifyEmailChange', () => {
    let userId: string
    const newEmail = 'newemail@test.example.com'
    const validToken = 'valid-email-change-token'

    beforeEach(async () => {
      const user = await createTestUser(prisma, {
        username: 'emailchange',
        email: 'old@test.example.com',
      })
      userId = user.id

      await prisma.user.update({
        where: { id: userId },
        data: {
          pendingEmail: newEmail,
          emailChangeToken: validToken,
          emailChangeExpires: new Date(Date.now() + 3600_000),
        },
      })
    })

    it(
      '有効トークン → email 更新、isEmailVerified === true、' +
        'pending クリア',
      async () => {
        const result = await authService.verifyEmailChange(validToken)
        expect(result.message).toBe('Email changed successfully')

        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
        })
        expect(dbUser!.email).toBe(newEmail)
        expect(dbUser!.isEmailVerified).toBe(true)
        expect(dbUser!.pendingEmail).toBeNull()
        expect(dbUser!.emailChangeToken).toBeNull()
        expect(dbUser!.emailChangeExpires).toBeNull()
      },
    )

    it('期限切れトークン → エラー', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          emailChangeExpires: new Date(Date.now() - 1000),
        },
      })

      await expect(authService.verifyEmailChange(validToken)).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('無効トークン → エラー', async () => {
      await expect(authService.verifyEmailChange('bad-token')).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('メールが既に使用済み → ConflictException', async () => {
      await createTestUser(prisma, {
        username: 'existing',
        email: newEmail,
      })

      await expect(authService.verifyEmailChange(validToken)).rejects.toThrow(
        ConflictException,
      )
    })
  })
})
