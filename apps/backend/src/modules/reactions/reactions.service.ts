import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { ActivityDeliveryService } from '../federation/services/activity-delivery.service'
import { ReactionSummary, ReactionResponse, UserReactionsResponse } from './dto/reaction-response.dto'

@Injectable()
export class ReactionsService {
  private readonly logger = new Logger(ReactionsService.name)
  private readonly ipSalt: string
  private readonly windowMs = 24 * 60 * 60 * 1000 // 24 hours

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private activityDelivery: ActivityDeliveryService,
    private eventEmitter: EventEmitter2,
  ) {
    this.ipSalt = this.configService.get<string>('REACTION_IP_SALT') || 'default-reaction-salt'
  }

  async addReaction(
    artworkId: string,
    emoji: string,
    userId?: string,
    ipHash?: string,
  ) {
    if (!userId && !ipHash) {
      throw new Error('Either userId or ipHash is required')
    }

    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: { author: true },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    const existingReaction = await this.findExistingReaction(artworkId, emoji, userId, ipHash)

    if (existingReaction) {
      return { reacted: true, emoji, message: 'Already reacted' }
    }

    const isFederatedArtwork = !!artwork.apObjectId

    let user = null
    if (userId) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
      })
    }

    const [reaction] = await this.prisma.$transaction([
      this.prisma.reaction.create({
        data: {
          artworkId,
          emoji,
          userId: userId || null,
          ipHash: userId ? null : ipHash, // Only store ipHash for anonymous
          federated: isFederatedArtwork && !!userId,
        },
      }),
      this.prisma.artwork.update({
        where: { id: artworkId },
        data: {
          reactionCount: { increment: 1 },
        },
      }),
    ])

    if (!userId && ipHash) {
      await this.updateAnonymousRateLimit(ipHash)
    }

    if (userId && isFederatedArtwork && artwork.author.inbox && artwork.apObjectId && user) {
      this.activityDelivery.sendEmojiReact(user, artwork.apObjectId, emoji, artwork.author.inbox).catch((err) => {
        this.logger.error(`Failed to send EmojiReact activity: ${err}`)
      })
    }

    if (userId && userId !== artwork.authorId) {
      this.eventEmitter.emit('artwork.reacted', {
        actorId: userId,
        artwork: {
          id: artwork.id,
          authorId: artwork.authorId,
        },
        reaction: {
          id: reaction.id,
          emoji,
        },
      })
    }

    return { reacted: true, emoji, message: 'Reaction added' }
  }

  async removeReaction(
    artworkId: string,
    emoji: string,
    userId?: string,
    ipHash?: string,
  ) {
    if (!userId && !ipHash) {
      throw new Error('Either userId or ipHash is required')
    }

    const existingReaction = await this.findExistingReaction(artworkId, emoji, userId, ipHash)

    if (!existingReaction) {
      return { reacted: false, emoji, message: 'Reaction removed' }
    }

    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: { author: true },
    })

    let user = null
    if (userId) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
      })
    }

    await this.prisma.$transaction([
      this.prisma.reaction.delete({
        where: { id: existingReaction.id },
      }),
      this.prisma.artwork.update({
        where: { id: artworkId },
        data: {
          reactionCount: { decrement: 1 },
        },
      }),
    ])

    if (userId && artwork?.apObjectId && artwork.author.inbox && user) {
      this.activityDelivery.sendUndoEmojiReact(user, artwork.apObjectId, emoji, artwork.author.inbox).catch((err) => {
        this.logger.error(`Failed to send Undo EmojiReact activity: ${err}`)
      })
    }

    return { reacted: false, emoji, message: 'Reaction removed' }
  }

  async toggleReaction(
    artworkId: string,
    emoji: string,
    userId?: string,
    ipHash?: string,
  ) {
    const existingReaction = await this.findExistingReaction(artworkId, emoji, userId, ipHash)

    if (existingReaction) {
      return this.removeReaction(artworkId, emoji, userId, ipHash)
    } else {
      return this.addReaction(artworkId, emoji, userId, ipHash)
    }
  }

  async getArtworkReactions(artworkId: string): Promise<ReactionResponse> {
    const reactions = await this.prisma.reaction.groupBy({
      by: ['emoji'],
      where: { artworkId },
      _count: { emoji: true },
      orderBy: { _count: { emoji: 'desc' } },
    })

    const summaries: ReactionSummary[] = reactions.map((r) => ({
      emoji: r.emoji,
      count: r._count.emoji,
    }))

    const total = summaries.reduce((sum, r) => sum + r.count, 0)

    return { reactions: summaries, total }
  }

  async getUserReactions(
    artworkId: string,
    userId?: string,
    ipHash?: string,
  ): Promise<UserReactionsResponse> {
    if (!userId && !ipHash) {
      return { emojis: [] }
    }

    const whereClause: any = { artworkId }
    if (userId) {
      whereClause.userId = userId
    } else {
      whereClause.ipHash = ipHash
    }

    const reactions = await this.prisma.reaction.findMany({
      where: whereClause,
      select: { emoji: true },
    })

    return { emojis: reactions.map((r) => r.emoji) }
  }

  hashIp(ip: string): string {
    return createHash('sha256')
      .update(ip + this.ipSalt)
      .digest('hex')
  }

  private async findExistingReaction(
    artworkId: string,
    emoji: string,
    userId?: string,
    ipHash?: string,
  ) {
    if (userId) {
      return this.prisma.reaction.findUnique({
        where: {
          user_artwork_emoji: {
            artworkId,
            userId,
            emoji,
          },
        },
      })
    } else if (ipHash) {
      return this.prisma.reaction.findUnique({
        where: {
          ip_artwork_emoji: {
            artworkId,
            ipHash,
            emoji,
          },
        },
      })
    }
    return null
  }

  private async updateAnonymousRateLimit(ipHash: string) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.windowMs)
    const windowStart = new Date(now.getTime() - this.windowMs)

    const existing = await this.prisma.anonymousReactionLimit.findUnique({
      where: { ipHash },
    })

    if (!existing) {
      await this.prisma.anonymousReactionLimit.create({
        data: {
          ipHash,
          reactionCount: 1,
          windowStart: now,
          expiresAt,
        },
      })
    } else if (existing.windowStart < windowStart) {
      await this.prisma.anonymousReactionLimit.update({
        where: { ipHash },
        data: {
          reactionCount: 1,
          windowStart: now,
          expiresAt,
        },
      })
    } else {
      await this.prisma.anonymousReactionLimit.update({
        where: { ipHash },
        data: {
          reactionCount: { increment: 1 },
        },
      })
    }
  }

  async cleanupExpiredRateLimits() {
    const now = new Date()
    const result = await this.prisma.anonymousReactionLimit.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    })
    this.logger.log(`Cleaned up ${result.count} expired anonymous reaction rate limits`)
    return result.count
  }
}
