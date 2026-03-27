import { BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { BlueskyOAuthService } from './bluesky-oauth.service'
import {
  createBlueskyOAuthTestModule,
  truncate,
} from '../../test/integration-helper'
import { createTestOAuthUser } from '../../test/fixtures'

describe('BlueskyOAuthService - Unlink Guard (integration)', () => {
  let blueskyOAuthService: BlueskyOAuthService
  let prisma: PrismaService
  let cleanup: () => Promise<void>

  beforeAll(async () => {
    const ctx = await createBlueskyOAuthTestModule()
    blueskyOAuthService = ctx.blueskyOAuthService
    prisma = ctx.prisma
    cleanup = ctx.cleanup
  })

  beforeEach(async () => {
    await truncate(prisma, 'users')
  })

  afterAll(async () => {
    await cleanup()
  })

  describe('unlinkBlueskyAccount', () => {
    it(
      'メール設定済み・検証済みユーザー → 解除成功' +
        '、Bluesky フィールド全てクリア',
      async () => {
        const user = await createTestOAuthUser(prisma)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            email: 'verified@test.example.com',
            isEmailVerified: true,
          },
        })

        await blueskyOAuthService.unlinkBlueskyAccount(user.id)

        const updated = await prisma.user.findUnique({
          where: { id: user.id },
        })
        expect(updated!.blueskyDid).toBeNull()
        expect(updated!.blueskyHandle).toBeNull()
        expect(updated!.blueskyVerified).toBe(false)
        expect(updated!.blueskyLinkedAt).toBeNull()
      },
    )

    it('メール未設定ユーザー → BadRequestException', async () => {
      const user = await createTestOAuthUser(prisma)

      await expect(
        blueskyOAuthService.unlinkBlueskyAccount(user.id),
      ).rejects.toThrow(BadRequestException)
    })

    it('メール未検証ユーザー → BadRequestException', async () => {
      const user = await createTestOAuthUser(prisma)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: 'unverified@test.example.com',
          isEmailVerified: false,
        },
      })

      await expect(
        blueskyOAuthService.unlinkBlueskyAccount(user.id),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
