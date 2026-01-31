import { Injectable, Logger, UnauthorizedException, InternalServerErrorException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EncryptionService } from '../auth/services/encryption.service'
import { SupporterTier } from '@prisma/client'
import * as crypto from 'crypto'

interface PatreonTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

interface PatreonMember {
  id: string
  attributes: {
    currently_entitled_amount_cents: number
    patron_status: string
  }
}

@Injectable()
export class PatreonService {
  private readonly logger = new Logger(PatreonService.name)
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  private readonly creatorAccessToken: string

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {
    this.clientId = process.env.PATREON_CLIENT_ID || ''
    this.clientSecret = process.env.PATREON_CLIENT_SECRET || ''
    this.redirectUri = process.env.PATREON_REDIRECT_URI || ''
    this.creatorAccessToken = process.env.PATREON_CREATOR_ACCESS_TOKEN || ''

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      this.logger.warn('Patreon OAuth credentials not configured')
    }
  }

  /**
   * Generate Patreon OAuth URL for user authentication
   */
  getAuthorizationUrl(): string {
    const scopes = ['identity', 'identity[email]', 'campaigns.members']
    const state = this.generateState()

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      state,
    })

    return `https://www.patreon.com/oauth2/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(code: string): Promise<PatreonTokens> {
    try {
      const response = await fetch('https://www.patreon.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
        }),
      })

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data as PatreonTokens
    } catch (error) {
      this.logger.error(`Failed to exchange code for tokens: ${error.message}`)
      throw new InternalServerErrorException('Failed to authenticate with Patreon')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<PatreonTokens> {
    try {
      const response = await fetch('https://www.patreon.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data as PatreonTokens
    } catch (error) {
      this.logger.error(`Failed to refresh token: ${error.message}`)
      throw new UnauthorizedException('Patreon token refresh failed')
    }
  }

  /**
   * Get user's Patreon identity
   */
  async getUserIdentity(accessToken: string): Promise<any> {
    try {
      // Build query parameters for the identity endpoint
      const params = new URLSearchParams({
        'include': 'memberships',
        'fields[user]': 'full_name,email,image_url',
        'fields[member]': 'currently_entitled_amount_cents,patron_status',
      })

      const response = await fetch(
        `https://www.patreon.com/api/oauth2/v2/identity?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Identity fetch failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      this.logger.error(`Failed to fetch Patreon identity: ${error.message}`)
      throw new InternalServerErrorException('Failed to fetch Patreon user data')
    }
  }

  /**
   * Link Patreon account to user
   */
  async linkPatreonAccount(userId: string, code: string): Promise<void> {
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code)

    // Get user identity
    const identity = await this.getUserIdentity(tokens.access_token)
    const patreonUserId = identity.data.id

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Update user with Patreon connection (encrypt tokens for secure storage)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        patreonId: patreonUserId,
        patreonAccessToken: this.encryptToken(tokens.access_token),
        patreonRefreshToken: this.encryptToken(tokens.refresh_token),
        patreonTokenExpiresAt: expiresAt,
        patreonLastSyncAt: new Date(),
      },
    })

    // Sync tier immediately after linking
    await this.syncUserTier(userId)

    this.logger.log(`Patreon account linked for user ${userId}`)
  }

  /**
   * Unlink Patreon account from user
   */
  async unlinkPatreonAccount(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        patreonId: null,
        patreonAccessToken: null,
        patreonRefreshToken: null,
        patreonTokenExpiresAt: null,
        patreonLastSyncAt: null,
        supporterTier: 'NONE',
        supporterSince: null,
        supporterExpiresAt: null,
      },
    })

    this.logger.log(`Patreon account unlinked for user ${userId}`)
  }

  /**
   * Sync user's supporter tier based on Patreon membership
   */
  async syncUserTier(userId: string): Promise<SupporterTier> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        patreonAccessToken: true,
        patreonRefreshToken: true,
        patreonTokenExpiresAt: true,
      },
    })

    if (!user || !user.patreonAccessToken) {
      throw new UnauthorizedException('Patreon account not linked')
    }

    // Decrypt stored tokens
    let accessToken = this.decryptToken(user.patreonAccessToken)

    // Refresh token if expired
    if (user.patreonTokenExpiresAt && user.patreonTokenExpiresAt < new Date()) {
      const decryptedRefreshToken = this.decryptToken(user.patreonRefreshToken!)
      const tokens = await this.refreshAccessToken(decryptedRefreshToken)
      accessToken = tokens.access_token

      // Update tokens in database (encrypt for storage)
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          patreonAccessToken: this.encryptToken(tokens.access_token),
          patreonRefreshToken: this.encryptToken(tokens.refresh_token),
          patreonTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      })
    }

    // Get membership data
    const identity = await this.getUserIdentity(accessToken)
    const tier = this.determineTierFromMembership(identity)

    // Update user's supporter tier
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        supporterTier: tier,
        supporterSince: tier !== 'NONE' ? (user.patreonAccessToken ? undefined : new Date()) : null,
        patreonLastSyncAt: new Date(),
      },
    })

    this.logger.log(`Synced tier for user ${userId}: ${tier}`)
    return tier
  }

  /**
   * Determine supporter tier based on Patreon membership amount
   */
  private determineTierFromMembership(identity: any): SupporterTier {
    // Check if user has active memberships
    const memberships = identity.included?.filter((inc: any) => inc.type === 'member') || []

    if (memberships.length === 0) {
      return 'NONE'
    }

    // Get the highest entitled amount across all memberships
    const maxAmount = Math.max(
      ...memberships.map((m: PatreonMember) => m.attributes?.currently_entitled_amount_cents || 0)
    )

    // Check patron status - must be active
    const hasActiveMembership = memberships.some(
      (m: PatreonMember) => m.attributes?.patron_status === 'active_patron'
    )

    if (!hasActiveMembership || maxAmount === 0) {
      return 'NONE'
    }

    // Tier thresholds in cents (USD)
    // TIER_1: $5+/month
    // TIER_2: $10+/month
    // TIER_3: $20+/month
    if (maxAmount >= 2000) {
      return 'TIER_3'
    } else if (maxAmount >= 1000) {
      return 'TIER_2'
    } else if (maxAmount >= 500) {
      return 'TIER_1'
    }

    return 'NONE'
  }

  /**
   * Generate cryptographically secure random state for OAuth
   * Uses crypto.randomBytes for CSRF protection
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Encrypt a token for secure storage
   */
  private encryptToken(token: string): string {
    return this.encryptionService.encrypt(token)
  }

  /**
   * Decrypt a stored token
   */
  private decryptToken(encryptedToken: string): string {
    return this.encryptionService.decrypt(encryptedToken)
  }
}
