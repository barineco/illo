import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { ActivityDeliveryService } from '../federation/services/activity-delivery.service'

@Injectable()
export class LikesService {
  private readonly logger = new Logger(LikesService.name)

  constructor(
    private prisma: PrismaService,
    private activityDelivery: ActivityDeliveryService,
    private eventEmitter: EventEmitter2,
  ) {}

  async toggleLike(userId: string, artworkId: string) {
    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_artworkId: {
          userId,
          artworkId,
        },
      },
    })

    if (existingLike) {
      await this.unlikeArtwork(userId, artworkId)
      return { liked: false, message: 'Unliked successfully' }
    } else {
      const like = await this.likeArtwork(userId, artworkId)
      return { liked: true, like }
    }
  }

  async likeArtwork(userId: string, artworkId: string) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        author: true,
      },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    const existingLike = await this.prisma.like.findUnique({
      where: {
        userId_artworkId: {
          userId,
          artworkId,
        },
      },
    })

    if (existingLike) {
      return existingLike
    }

    const likerUser = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!likerUser) {
      throw new NotFoundException('User not found')
    }

    const isFederatedArtwork = !!artwork.apObjectId

    const [like] = await this.prisma.$transaction([
      this.prisma.like.create({
        data: {
          userId,
          artworkId,
          federated: isFederatedArtwork,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          artwork: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      this.prisma.artwork.update({
        where: { id: artworkId },
        data: {
          likeCount: {
            increment: 1,
          },
        },
      }),
    ])

    if (isFederatedArtwork && artwork.author.inbox && artwork.apObjectId) {
      this.activityDelivery.sendLike(likerUser, artwork.apObjectId, artwork.author.inbox).catch((err) => {
        this.logger.error(`Failed to send Like activity: ${err}`)
      })
    }

    if (userId !== artwork.authorId) {
      this.eventEmitter.emit('artwork.liked', {
        actorId: userId,
        artwork: {
          id: artwork.id,
          authorId: artwork.authorId,
        },
        like: {
          id: like.id,
        },
      })
    }

    return like
  }

  async unlikeArtwork(userId: string, artworkId: string) {
    const like = await this.prisma.like.findUnique({
      where: {
        userId_artworkId: {
          userId,
          artworkId,
        },
      },
    })

    if (!like) {
      return { message: 'Unliked successfully' }
    }

    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: { author: true },
    })

    const likerUser = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    await this.prisma.$transaction([
      this.prisma.like.delete({
        where: {
          userId_artworkId: {
            userId,
            artworkId,
          },
        },
      }),
      this.prisma.artwork.update({
        where: { id: artworkId },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      }),
    ])

    if (artwork?.apObjectId && artwork.author.inbox && likerUser) {
      this.activityDelivery.sendUndoLike(likerUser, artwork.apObjectId, artwork.author.inbox).catch((err) => {
        this.logger.error(`Failed to send Undo Like activity: ${err}`)
      })
    }

    return { message: 'Unliked successfully' }
  }

  async hasLiked(userId: string, artworkId: string): Promise<boolean> {
    const like = await this.prisma.like.findUnique({
      where: {
        userId_artworkId: {
          userId,
          artworkId,
        },
      },
    })

    return !!like
  }

  async getArtworkLikes(artworkId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit

    const [likes, total] = await Promise.all([
      this.prisma.like.findMany({
        where: { artworkId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.like.count({
        where: { artworkId },
      }),
    ])

    return {
      likes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getUserLikedArtworks(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit

    const [likes, total] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId },
        include: {
          artwork: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
              images: {
                orderBy: {
                  order: 'asc',
                },
              },
              tags: {
                include: {
                  tag: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.like.count({
        where: { userId },
      }),
    ])

    const artworks = likes.map((like) => ({
      ...like.artwork,
      thumbnailUrl: like.artwork.images[0]?.thumbnailUrl || '',
      tags: like.artwork.tags.map((at) => at.tag),
    }))

    return {
      artworks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  private parseUserHandle(handle: string): { username: string; domain: string } {
    const parts = handle.split('@')
    if (parts.length === 1) {
      return { username: parts[0], domain: '' }
    } else if (parts.length === 2) {
      return { username: parts[0], domain: parts[1] }
    }
    throw new NotFoundException(`Invalid user handle format: ${handle}`)
  }

  async getUserLikedArtworksByUsername(
    handle: string,
    page = 1,
    limit = 20,
  ) {
    const { username, domain } = this.parseUserHandle(handle)

    const user = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain,
        },
      },
      select: { id: true },
    })

    if (!user) {
      throw new NotFoundException(`User @${handle} not found`)
    }

    return this.getUserLikedArtworks(user.id, page, limit)
  }
}
