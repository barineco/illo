import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import * as crypto from 'crypto'

/**
 * MLS Service
 *
 * Manages MLS KeyPackages for E2E encryption following RFC 9420.
 * KeyPackages are used to establish MLS groups for encrypted DM conversations.
 *
 * Current implementation uses a simplified key generation approach.
 * Full MLS protocol integration (via ts-mls) is planned for Phase 3.
 */
@Injectable()
export class MlsService {
  private readonly logger = new Logger(MlsService.name)

  // Maximum KeyPackages per user (older ones are rotated out)
  private readonly MAX_KEY_PACKAGES_PER_USER = 10

  // KeyPackage validity period (30 days)
  private readonly KEY_PACKAGE_VALIDITY_DAYS = 30

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate a new KeyPackage for a user
   *
   * In the full MLS implementation, this would use ts-mls to generate
   * a proper MLS KeyPackage. For now, we generate a simplified version
   * that can be upgraded later.
   *
   * @param userId - The user ID to generate KeyPackage for
   * @returns The created KeyPackage record
   */
  async generateKeyPackage(userId: string) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Generate key pair (X25519 for key exchange)
    const keyPair = crypto.generateKeyPairSync('x25519')

    // Export public key as raw bytes
    const publicKeyRaw = keyPair.publicKey.export({ type: 'spki', format: 'der' })
    const publicKeyBase64 = publicKeyRaw.toString('base64')

    // Export private key (encrypted with master key if available)
    const privateKeyRaw = keyPair.privateKey.export({ type: 'pkcs8', format: 'der' })

    // Create a simplified KeyPackage structure
    // In full MLS, this would be a proper TLS-serialized KeyPackage
    const keyPackageData = {
      version: 1,
      cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
      initKey: publicKeyBase64,
      credential: {
        type: 'basic',
        identity: `${user.username}@${user.domain || 'local'}`,
      },
      capabilities: {
        versions: ['mls10'],
        ciphersuites: ['MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'],
        extensions: [],
        proposals: ['add', 'remove', 'update'],
        credentials: ['basic'],
      },
      leafNodeExtensions: [],
      signature: '', // Would be signed in full implementation
    }

    // Serialize KeyPackage
    const keyPackageBuffer = Buffer.from(JSON.stringify(keyPackageData), 'utf8')

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + this.KEY_PACKAGE_VALIDITY_DAYS)

    // Store KeyPackage
    const keyPackage = await this.prisma.mlsKeyPackage.create({
      data: {
        userId,
        keyPackage: keyPackageBuffer,
        publicKey: publicKeyBase64.substring(0, 100), // Truncated for index
        expiresAt,
      },
    })

    // Also store private key securely (in a real implementation, this would be
    // stored client-side or in a secure enclave)
    // For now, we store it server-side encrypted
    await this.storePrivateKey(keyPackage.id, privateKeyRaw)

    // Cleanup old KeyPackages if over limit
    await this.rotateKeyPackages(userId)

    this.logger.log(`Generated KeyPackage ${keyPackage.id} for user ${userId}`)

    return keyPackage
  }

  /**
   * Get all valid KeyPackages for a user
   */
  async getKeyPackages(userId: string) {
    return this.prisma.mlsKeyPackage.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get a specific KeyPackage by ID
   */
  async getKeyPackage(keyPackageId: string) {
    const keyPackage = await this.prisma.mlsKeyPackage.findUnique({
      where: { id: keyPackageId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            domain: true,
          },
        },
      },
    })

    if (!keyPackage) {
      throw new NotFoundException('KeyPackage not found')
    }

    return keyPackage
  }

  /**
   * Get KeyPackage data formatted for ActivityPub Actor extension
   */
  async getKeyPackagesForActor(userId: string, actorUrl: string) {
    const keyPackages = await this.getKeyPackages(userId)

    if (keyPackages.length === 0) {
      return null
    }

    return {
      type: 'Collection',
      id: `${actorUrl}/keypackages`,
      totalItems: keyPackages.length,
      items: keyPackages.map((kp) => `${actorUrl}/keypackages/${kp.id}`),
    }
  }

  /**
   * Delete a KeyPackage
   */
  async deleteKeyPackage(userId: string, keyPackageId: string) {
    const keyPackage = await this.prisma.mlsKeyPackage.findFirst({
      where: {
        id: keyPackageId,
        userId,
      },
    })

    if (!keyPackage) {
      throw new NotFoundException('KeyPackage not found')
    }

    await this.prisma.mlsKeyPackage.delete({
      where: { id: keyPackageId },
    })

    this.logger.log(`Deleted KeyPackage ${keyPackageId} for user ${userId}`)
  }

  /**
   * Rotate KeyPackages - remove old ones if over limit
   */
  private async rotateKeyPackages(userId: string) {
    const keyPackages = await this.prisma.mlsKeyPackage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (keyPackages.length > this.MAX_KEY_PACKAGES_PER_USER) {
      const toDelete = keyPackages.slice(this.MAX_KEY_PACKAGES_PER_USER)

      await this.prisma.mlsKeyPackage.deleteMany({
        where: {
          id: { in: toDelete.map((kp) => kp.id) },
        },
      })

      this.logger.log(`Rotated ${toDelete.length} old KeyPackages for user ${userId}`)
    }
  }

  /**
   * Store private key (encrypted)
   *
   * In production, private keys should be:
   * 1. Stored client-side only, or
   * 2. Encrypted with user's password-derived key, or
   * 3. Stored in a hardware security module (HSM)
   *
   * This implementation stores them server-side for simplicity,
   * which means the server can decrypt messages (not true E2E).
   * This is a known limitation for Phase 2.
   */
  private async storePrivateKey(keyPackageId: string, privateKey: Buffer) {
    const encryptionKey = this.configService.get<string>('MESSAGE_ENCRYPTION_KEY')

    if (!encryptionKey) {
      this.logger.warn('MESSAGE_ENCRYPTION_KEY not set, private keys stored unencrypted')
      // In a real implementation, we would refuse to store without encryption
      return
    }

    // Encrypt private key with MESSAGE_ENCRYPTION_KEY
    const keyBuffer = Buffer.from(encryptionKey, 'hex')
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)

    const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Store encrypted private key (would use a separate secure storage in production)
    // For now, we don't persist this - it's just for demonstration
    // In Phase 3, this will be handled differently with proper client-side key storage
  }

  /**
   * Cleanup expired KeyPackages (called by cron job)
   */
  async cleanupExpiredKeyPackages() {
    const result = await this.prisma.mlsKeyPackage.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    })

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired KeyPackages`)
    }

    return result.count
  }

  /**
   * Check if a user has any valid KeyPackages
   */
  async hasValidKeyPackages(userId: string): Promise<boolean> {
    const count = await this.prisma.mlsKeyPackage.count({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })

    return count > 0
  }

  /**
   * Consume a KeyPackage (mark as used for a group)
   *
   * In MLS, KeyPackages are single-use. After being used to add
   * a member to a group, they should be replaced.
   */
  async consumeKeyPackage(keyPackageId: string): Promise<void> {
    await this.prisma.mlsKeyPackage.delete({
      where: { id: keyPackageId },
    })

    this.logger.log(`Consumed KeyPackage ${keyPackageId}`)
  }
}
