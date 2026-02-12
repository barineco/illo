import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { User, MlsKeyPackage } from '@prisma/client'
import * as NodeRSA from 'node-rsa'
import { Actor, DEFAULT_CONTEXT } from '@illo/shared'
import { KeyPair } from '../dto/actor.dto'

// Extended context for MLS over ActivityPub
const MLS_CONTEXT = 'https://purl.archive.org/socialweb/mls'

@Injectable()
export class ActorService {
  private readonly logger = new Logger(ActorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate RSA key pair for ActivityPub
   */
  async generateKeyPair(): Promise<KeyPair> {
    const key = new NodeRSA({ b: 2048 })

    const publicKey = key.exportKey('public')
    const privateKey = key.exportKey('private')

    return {
      publicKey,
      privateKey,
    }
  }

  /**
   * Ensure user has RSA keys (generate if missing)
   */
  async ensureUserHasKeys(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`)
    }

    // If user already has keys, return as-is
    if (user.publicKey && user.privateKey) {
      return user
    }

    // Generate new keys
    this.logger.log(`Generating keys for user ${user.username}`)
    const keyPair = await this.generateKeyPair()

    // Update user with keys
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
      },
    })

    return updatedUser
  }

  /**
   * Get public URL from instance settings or fallback to BASE_URL env var
   */
  async getPublicUrl(): Promise<string> {
    // Try to get from database first
    const settings = await this.prisma.instanceSettings.findFirst()
    if (settings?.publicUrl) {
      return settings.publicUrl
    }

    // Fallback to BASE_URL environment variable
    const baseUrl = this.configService.get<string>('BASE_URL')
    if (!baseUrl) {
      throw new Error('Public URL not configured in database or BASE_URL environment variable')
    }

    return baseUrl
  }

  /**
   * Build ActivityPub Actor object for a user
   *
   * @param user - User entity
   * @param includeKeyPackages - Whether to include MLS KeyPackages (default: true)
   */
  async buildActorObject(user: User, includeKeyPackages = true): Promise<Actor> {
    const publicUrl = await this.getPublicUrl()

    // Ensure user has keys
    const userWithKeys =
      user.publicKey && user.privateKey ? user : await this.ensureUserHasKeys(user.id)

    if (!userWithKeys.publicKey) {
      throw new Error(`User ${user.username} has no public key`)
    }

    const actorId = `${publicUrl}/users/${user.username}`

    // Check if user has MLS KeyPackages
    let mlsKeyPackages: MlsKeyPackage[] = []
    if (includeKeyPackages) {
      mlsKeyPackages = await this.prisma.mlsKeyPackage.findMany({
        where: {
          userId: user.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    }

    // Determine context based on MLS support
    const context =
      mlsKeyPackages.length > 0 ? [...DEFAULT_CONTEXT, MLS_CONTEXT] : DEFAULT_CONTEXT

    const actor: Actor = {
      '@context': context,
      id: actorId,
      type: 'Person',
      preferredUsername: user.username,
      name: user.displayName || user.username,
      summary: user.bio || null,
      inbox: `${actorId}/inbox`,
      outbox: `${actorId}/outbox`,
      followers: `${actorId}/followers`,
      following: `${actorId}/following`,
      liked: `${actorId}/liked`,
      url: actorId,
      publicKey: {
        id: `${actorId}#main-key`,
        owner: actorId,
        publicKeyPem: userWithKeys.publicKey,
      },
      manuallyApprovesFollowers: false,
      discoverable: true,
      // Add illo software metadata for instance trust verification
      attachment: [
        {
          type: 'PropertyValue',
          name: 'Software',
          value: 'illo',
        },
      ],
    }

    // Add MLS KeyPackages collection if user has any
    if (mlsKeyPackages.length > 0) {
      ;(actor as any).keyPackages = {
        type: 'Collection',
        id: `${actorId}/keypackages`,
        totalItems: mlsKeyPackages.length,
        items: mlsKeyPackages.map((kp) => `${actorId}/keypackages/${kp.id}`),
      }
    }

    // Add avatar if present
    if (user.avatarUrl) {
      actor.icon = {
        type: 'Image',
        mediaType: 'image/jpeg',
        url: user.avatarUrl,
      }
    }

    // Add cover image if present
    if (user.coverImageUrl) {
      actor.image = {
        type: 'Image',
        mediaType: 'image/jpeg',
        url: user.coverImageUrl,
      }
    }

    return actor
  }

  /**
   * Get Actor object for a local user by username
   */
  async getLocalActorByUsername(username: string): Promise<Actor> {
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '', // Local users only
      },
    })

    if (!user) {
      throw new NotFoundException(`User not found: ${username}`)
    }

    return this.buildActorObject(user)
  }

  /**
   * Get system actor credentials for HTTP signature
   * Uses the first admin user as the system actor
   * This is used for server-to-server communication like federation image fetching
   */
  async getSystemActorCredentials(): Promise<{
    keyId: string
    privateKey: string
    actorUrl: string
  }> {
    // Find first admin user with keys
    let systemUser = await this.prisma.user.findFirst({
      where: {
        role: 'ADMIN',
        domain: '', // Local users only
        privateKey: { not: null },
        publicKey: { not: null },
      },
    })

    // If no admin with keys, find any admin and generate keys
    if (!systemUser) {
      const admin = await this.prisma.user.findFirst({
        where: {
          role: 'ADMIN',
          domain: '', // Local users only
        },
      })

      if (!admin) {
        throw new Error('No admin user found for system actor')
      }

      systemUser = await this.ensureUserHasKeys(admin.id)
    }

    if (!systemUser.privateKey) {
      throw new Error('System actor has no private key')
    }

    const publicUrl = await this.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${systemUser.username}`
    const keyId = `${actorUrl}#main-key`

    return {
      keyId,
      privateKey: systemUser.privateKey,
      actorUrl,
    }
  }
}
