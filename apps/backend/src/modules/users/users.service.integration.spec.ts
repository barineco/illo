import { BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from './users.service'
import {
  createUsersTestModule,
  SpyMailService,
  truncate,
} from '../../test/integration-helper'
import {
  createTestUser,
  createTestOAuthUser,
  DEFAULT_TEST_PASSWORD,
} from '../../test/fixtures'

describe('UsersService - Email Change (integration)', () => {
  let usersService: UsersService
  let prisma: PrismaService
  let mailService: SpyMailService
  let cleanup: () => Promise<void>

  beforeAll(async () => {
    const ctx = await createUsersTestModule()
    usersService = ctx.usersService
    prisma = ctx.prisma
    mailService = ctx.mailService
    cleanup = ctx.cleanup
  })

  beforeEach(async () => {
    await truncate(prisma, 'users')
    mailService.reset()
  })

  afterAll(async () => {
    await cleanup()
  })

  describe('requestEmailChange', () => {
    it('OAuth ユーザー → pendingEmail 設定、パスワード不要', async () => {
      const user = await createTestOAuthUser(prisma)
      const newEmail = 'new@example.com'

      const result = await usersService.requestEmailChange(user.id, newEmail)

      expect(result.message).toBeDefined()

      const updated = await prisma.user.findUnique({
        where: { id: user.id },
      })
      expect(updated!.pendingEmail).toBe(newEmail)
      expect(updated!.emailChangeToken).not.toBeNull()
      expect(updated!.emailChangeExpires).not.toBeNull()

      const verCalls = mailService.calls.get('sendEmailChangeVerification')
      expect(verCalls).toHaveLength(1)
      expect(verCalls![0][0]).toBe(newEmail)
      expect(verCalls![0][1]).toBe(user.username)

      const notifCalls = mailService.calls.get('sendEmailChangeNotification')
      expect(notifCalls).toBeUndefined()
    })

    it('メール設定済みユーザー + パスワード → 成功', async () => {
      const user = await createTestUser(prisma)
      const newEmail = 'changed@example.com'

      const result = await usersService.requestEmailChange(
        user.id,
        newEmail,
        DEFAULT_TEST_PASSWORD,
      )

      expect(result.message).toBeDefined()

      const updated = await prisma.user.findUnique({
        where: { id: user.id },
      })
      expect(updated!.pendingEmail).toBe(newEmail)

      const verCalls = mailService.calls.get('sendEmailChangeVerification')
      expect(verCalls).toHaveLength(1)
      expect(verCalls![0][0]).toBe(newEmail)

      const notifCalls = mailService.calls.get('sendEmailChangeNotification')
      expect(notifCalls).toHaveLength(1)
      expect(notifCalls![0][0]).toBe(user.email)
      expect(notifCalls![0][1]).toBe(user.username)
    })

    it('メール設定済みユーザー + パスワードなし → BadRequestException', async () => {
      const user = await createTestUser(prisma)

      await expect(
        usersService.requestEmailChange(user.id, 'new@example.com'),
      ).rejects.toThrow(BadRequestException)
    })

    it('既に使用されているメール → ConflictException', async () => {
      const existing = await createTestUser(prisma, {
        email: 'taken@example.com',
      })
      const user = await createTestUser(prisma)

      await expect(
        usersService.requestEmailChange(
          user.id,
          'taken@example.com',
          DEFAULT_TEST_PASSWORD,
        ),
      ).rejects.toThrow(ConflictException)
    })

    it('現在と同じメール → BadRequestException', async () => {
      const user = await createTestUser(prisma)

      await expect(
        usersService.requestEmailChange(
          user.id,
          user.email!,
          DEFAULT_TEST_PASSWORD,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('cancelEmailChange', () => {
    it('pending あり → pending フィールドクリア', async () => {
      const user = await createTestUser(prisma)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          pendingEmail: 'pending@example.com',
          emailChangeToken: 'some-token',
          emailChangeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      const result = await usersService.cancelEmailChange(user.id)

      expect(result.message).toBeDefined()

      const updated = await prisma.user.findUnique({
        where: { id: user.id },
      })
      expect(updated!.pendingEmail).toBeNull()
      expect(updated!.emailChangeToken).toBeNull()
      expect(updated!.emailChangeExpires).toBeNull()
    })
  })
})
