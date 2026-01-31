import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCommentDto } from './dto/create-comment.dto'
import { UpdateCommentDto } from './dto/update-comment.dto'
import { ActivityDeliveryService } from '../federation/services/activity-delivery.service'
import { MutesService } from '../mutes/mutes.service'

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name)

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ActivityDeliveryService))
    private activityDelivery: ActivityDeliveryService,
    private eventEmitter: EventEmitter2,
    private mutesService: MutesService,
  ) {}

  async createComment(
    userId: string,
    artworkId: string,
    createCommentDto: CreateCommentDto,
  ) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        author: true,
      },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    let parentComment = null
    if (createCommentDto.parentId) {
      parentComment = await this.prisma.comment.findUnique({
        where: { id: createCommentDto.parentId },
      })

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found')
      }

      // Parent comment must belong to the same artwork
      if (parentComment.artworkId !== artworkId) {
        throw new BadRequestException(
          'Parent comment does not belong to this artwork',
        )
      }
    }

    const [comment] = await this.prisma.$transaction([
      this.prisma.comment.create({
        data: {
          userId,
          artworkId,
          content: createCommentDto.content,
          parentId: createCommentDto.parentId || null,
          federated: false, // Will be set to true when federating
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
          replies: {
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
              createdAt: 'asc',
            },
          },
        },
      }),
      this.prisma.artwork.update({
        where: { id: artworkId },
        data: {
          commentCount: {
            increment: 1,
          },
        },
      }),
    ])

    if (parentComment) {
      // This is a reply - emit comment.replied event (skip if replying to own comment)
      if (userId !== parentComment.userId) {
        this.eventEmitter.emit('comment.replied', {
          actorId: userId,
          parentComment: {
            id: parentComment.id,
            userId: parentComment.userId,
          },
          comment: {
            id: comment.id,
          },
          artwork: {
            id: artwork.id,
          },
        })
      }
    } else {
      // This is a direct comment on artwork - emit artwork.commented event (skip if commenting on own artwork)
      if (userId !== artwork.authorId) {
        this.eventEmitter.emit('artwork.commented', {
          actorId: userId,
          artwork: {
            id: artwork.id,
            authorId: artwork.authorId,
          },
          comment: {
            id: comment.id,
          },
        })
      }
    }

    if (artwork.author.domain && artwork.author.inbox) {
      const commenter = await this.prisma.user.findUnique({
        where: { id: userId },
      })

      if (commenter && commenter.domain === '' && commenter.privateKey) {
        const commentWithArtwork = await this.prisma.comment.findUnique({
          where: { id: comment.id },
          include: {
            artwork: {
              include: {
                author: true,
              },
            },
          },
        })

        if (commentWithArtwork) {
          this.activityDelivery
            .sendCreateComment(commenter, commentWithArtwork)
            .then((sent) => {
              if (sent) {
                this.logger.log(`Sent federated comment to ${artwork.author.username}@${artwork.author.domain}`)
                this.prisma.comment.update({
                  where: { id: comment.id },
                  data: { federated: true },
                }).catch((err) => this.logger.error(`Failed to mark comment as federated: ${err}`))
              }
            })
            .catch((err) => this.logger.error(`Failed to send federated comment: ${err}`))
        }
      }
    }

    return comment
  }

  async getArtworkComments(artworkId: string, page = 1, limit = 20, currentUserId?: string) {
    const skip = (page - 1) * limit

    let mutedUserIds: string[] = []
    let wordMutes: { keyword: string; regex: boolean; wholeWord: boolean; caseSensitive: boolean }[] = []

    if (currentUserId) {
      [mutedUserIds, wordMutes] = await Promise.all([
        this.mutesService.getMutedUserIds(currentUserId),
        this.mutesService.getWordMutes(currentUserId),
      ])
    }

    const where: any = {
      artworkId,
      parentId: null,
    }

    if (mutedUserIds.length > 0) {
      where.userId = { notIn: mutedUserIds }
    }

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          replies: {
            where: mutedUserIds.length > 0 ? { userId: { notIn: mutedUserIds } } : undefined,
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
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ])

    let filteredComments = comments
    if (wordMutes.length > 0) {
      filteredComments = comments.filter((comment) => {
        if (this.matchesAnyWordMute(comment.content, wordMutes)) {
          return false
        }
        return true
      }).map((comment) => ({
        ...comment,
        replies: comment.replies.filter((reply) => {
          return !this.matchesAnyWordMute(reply.content, wordMutes)
        }),
      }))
    }

    return {
      comments: filteredComments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  private matchesAnyWordMute(
    text: string,
    wordMutes: { keyword: string; regex: boolean; wholeWord: boolean; caseSensitive: boolean }[],
  ): boolean {
    for (const mute of wordMutes) {
      if (this.textMatchesWordMute(text, mute)) {
        return true
      }
    }
    return false
  }

  private textMatchesWordMute(
    text: string,
    mute: { keyword: string; regex: boolean; wholeWord: boolean; caseSensitive: boolean },
  ): boolean {
    const searchText = mute.caseSensitive ? text : text.toLowerCase()
    const keyword = mute.caseSensitive ? mute.keyword : mute.keyword.toLowerCase()

    if (mute.regex) {
      try {
        const flags = mute.caseSensitive ? '' : 'i'
        const regex = new RegExp(mute.keyword, flags)
        return regex.test(text)
      } catch {
        return false
      }
    }

    if (mute.wholeWord) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, mute.caseSensitive ? '' : 'i')
      return regex.test(text)
    }

    return searchText.includes(keyword)
  }

  async updateComment(
    commentId: string,
    userId: string,
    updateCommentDto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!comment) {
      throw new NotFoundException('Comment not found')
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments')
    }

    const updatedComment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: updateCommentDto.content,
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
        replies: {
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
            createdAt: 'asc',
          },
        },
      },
    })

    return updatedComment
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        replies: true,
      },
    })

    if (!comment) {
      throw new NotFoundException('Comment not found')
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments')
    }

    // Replies will be cascade deleted due to onDelete: Cascade in schema
    const totalDeleted = 1 + comment.replies.length

    await this.prisma.$transaction([
      this.prisma.comment.delete({
        where: { id: commentId },
      }),
      this.prisma.artwork.update({
        where: { id: comment.artworkId },
        data: {
          commentCount: {
            decrement: totalDeleted,
          },
        },
      }),
    ])

    return { message: 'Comment deleted successfully' }
  }
}
