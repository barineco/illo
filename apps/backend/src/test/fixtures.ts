import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../modules/prisma/prisma.service'

export const DEFAULT_TEST_PASSWORD = 'TestPassword123!'
export const HASHED_PASSWORD = bcrypt.hashSync(DEFAULT_TEST_PASSWORD, 10)

const TEST_KEY_PAIR = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

export const TEST_PUBLIC_KEY = TEST_KEY_PAIR.publicKey as string
export const TEST_PRIVATE_KEY = TEST_KEY_PAIR.privateKey as string

export async function createTestUser(
  prisma: PrismaService,
  overrides?: Record<string, any>,
) {
  const username =
    overrides?.username ?? `test-${crypto.randomUUID().slice(0, 8)}`
  const baseUrl = 'http://localhost:3000'
  const actorUrl = `${baseUrl}/users/${username}`

  const defaults = {
    username,
    email: `${username}@test.example.com`,
    passwordHash: HASHED_PASSWORD,
    hasSetPassword: true,
    isActive: true,
    isEmailVerified: true,
    publicKey: TEST_PUBLIC_KEY,
    privateKey: TEST_PRIVATE_KEY,
    actorUrl,
    inbox: `${actorUrl}/inbox`,
    outbox: `${actorUrl}/outbox`,
    followersUrl: `${actorUrl}/followers`,
    followingUrl: `${actorUrl}/following`,
  }

  return prisma.user.create({
    data: { ...defaults, ...overrides },
  })
}

export async function createTestOAuthUser(
  prisma: PrismaService,
  overrides?: Record<string, any>,
) {
  const username =
    overrides?.username ?? `test-${crypto.randomUUID().slice(0, 8)}`

  return createTestUser(prisma, {
    username,
    email: undefined,
    hasSetPassword: false,
    isEmailVerified: false,
    blueskyDid: `did:plc:test-${crypto.randomUUID().slice(0, 8)}`,
    blueskyHandle: `${username}.bsky.social`,
    blueskyVerified: true,
    blueskyLinkedAt: new Date(),
    ...overrides,
  })
}
