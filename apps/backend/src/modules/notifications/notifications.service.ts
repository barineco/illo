import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationDto } from './dto/notification.dto'
import { NotificationQueryDto } from './dto/notification-query.dto'
import { NotificationType } from '@prisma/client'

// Event payload interfaces
export interface ArtworkLikedEvent {
  actorId: string
  artwork: {
    id: string
    authorId: string
  }
  like: {
    id: string
  }
}

export interface ArtworkCommentedEvent {
  actorId: string
  artwork: {
    id: string
    authorId: string
  }
  comment: {
    id: string
  }
}

export interface CommentRepliedEvent {
  actorId: string
  parentComment: {
    id: string
    userId: string
  }
  comment: {
    id: string
  }
  artwork: {
    id: string
  }
}

export interface UserFollowedEvent {
  actorId: string
  followedUserId: string
  follow: {
    id: string
  }
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Event handlers
  @OnEvent('artwork.liked')
  async handleArtworkLiked(payload: ArtworkLikedEvent) {
    // Don't create notification if user likes their own artwork
    if (payload.actorId === payload.artwork.authorId) {
      return
    }

    await this.prisma.notification.create({
      data: {
        userId: payload.artwork.authorId,
        type: NotificationType.LIKE,
        actorId: payload.actorId,
        artworkId: payload.artwork.id,
        likeId: payload.like.id,
      },
    })
  }

  @OnEvent('artwork.commented')
  async handleArtworkCommented(payload: ArtworkCommentedEvent) {
    // Don't create notification if user comments on their own artwork
    if (payload.actorId === payload.artwork.authorId) {
      return
    }

    await this.prisma.notification.create({
      data: {
        userId: payload.artwork.authorId,
        type: NotificationType.COMMENT,
        actorId: payload.actorId,
        artworkId: payload.artwork.id,
        commentId: payload.comment.id,
      },
    })
  }

  @OnEvent('comment.replied')
  async handleCommentReplied(payload: CommentRepliedEvent) {
    // Don't create notification if user replies to their own comment
    if (payload.actorId === payload.parentComment.userId) {
      return
    }

    await this.prisma.notification.create({
      data: {
        userId: payload.parentComment.userId,
        type: NotificationType.COMMENT_REPLY,
        actorId: payload.actorId,
        artworkId: payload.artwork.id,
        commentId: payload.comment.id,
      },
    })
  }

  @OnEvent('user.followed')
  async handleUserFollowed(payload: UserFollowedEvent) {
    await this.prisma.notification.create({
      data: {
        userId: payload.followedUserId,
        type: NotificationType.FOLLOW,
        actorId: payload.actorId,
        followId: payload.follow.id,
      },
    })
  }

  // API methods
  async getNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<{ notifications: NotificationDto[]; total: number }> {
    const { unreadOnly, page = 1, limit = 20 } = query
    const skip = (page - 1) * limit

    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              domain: true,
            },
          },
          artwork: {
            select: {
              id: true,
              title: true,
              images: {
                select: {
                  id: true,
                  thumbnailUrl: true,
                },
                take: 1,
                orderBy: {
                  order: 'asc',
                },
              },
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
            },
          },
          character: {
            select: {
              id: true,
              name: true,
              representativeArtwork: {
                select: {
                  id: true,
                  images: {
                    take: 1,
                    orderBy: { order: 'asc' },
                    select: { thumbnailUrl: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ])

    return {
      notifications: notifications as any,
      total,
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user can only mark their own notifications
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId, // Ensure user can only delete their own notifications
      },
    })
  }
}
