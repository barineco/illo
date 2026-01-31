import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { FollowStatus } from '@prisma/client'
import { ActivityDeliveryService } from '../federation/services/activity-delivery.service'

@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name)

  constructor(
    private prisma: PrismaService,
    private activityDelivery: ActivityDeliveryService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Parse username handle to extract username and domain
   * Supports formats: "username" or "username@domain"
   */
  private parseUserHandle(handle: string): { username: string; domain: string } {
    const parts = handle.split('@')
    if (parts.length === 1) {
      // Local user: "username"
      return { username: parts[0], domain: '' }
    } else if (parts.length === 2) {
      // Remote user: "username@domain"
      return { username: parts[0], domain: parts[1] }
    }
    throw new NotFoundException(`Invalid user handle format: ${handle}`)
  }

  /**
   * Toggle follow on a user (follow if not following, unfollow if already following)
   * @param followerId - Follower user ID
   * @param followingHandle - Username or username@domain to toggle
   * @returns Result with following status
   */
  async toggleFollow(followerId: string, followingHandle: string) {
    const { username, domain } = this.parseUserHandle(followingHandle)

    // Get following user by username and domain
    const followingUser = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain,
        },
      },
    })

    if (!followingUser) {
      throw new NotFoundException('User not found')
    }

    // Cannot follow yourself
    if (followerId === followingUser.id) {
      throw new BadRequestException('Cannot follow yourself')
    }

    // Check if already following
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: followingUser.id,
        },
      },
    })

    if (existingFollow) {
      // Unfollow
      await this.unfollowUser(followerId, followingHandle)
      return { following: false, message: 'Unfollowed successfully' }
    } else {
      // Follow
      const follow = await this.followUser(followerId, followingHandle)
      return { following: true, follow }
    }
  }

  /**
   * Follow a user (idempotent - safe to call multiple times)
   * @param followerId - Follower user ID
   * @param followingHandle - Username or username@domain to follow
   * @returns Created follow or existing follow
   */
  async followUser(followerId: string, followingHandle: string) {
    const { username, domain } = this.parseUserHandle(followingHandle)

    // Get following user by username and domain
    const followingUser = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain,
        },
      },
    })

    if (!followingUser) {
      throw new NotFoundException('User not found')
    }

    // Cannot follow yourself
    if (followerId === followingUser.id) {
      throw new BadRequestException('Cannot follow yourself')
    }

    // Check if already following - return existing state instead of error (idempotent)
    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: followingUser.id,
        },
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    if (existingFollow) {
      // Already following - return success with current state (idempotent)
      return existingFollow
    }

    // Get follower user for activity delivery
    const followerUser = await this.prisma.user.findUnique({
      where: { id: followerId },
    })

    if (!followerUser) {
      throw new NotFoundException('Follower user not found')
    }

    // Create follow with ACCEPTED status (auto-accept for now)
    // In the future, this can be PENDING based on user settings
    const follow = await this.prisma.follow.create({
      data: {
        followerId,
        followingId: followingUser.id,
        status: FollowStatus.ACCEPTED,
        federated: !!domain, // Mark as federated if following a remote user
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    // Send Follow activity to remote user's inbox
    if (domain && followingUser.inbox) {
      this.activityDelivery.sendFollow(followerUser, followingUser).catch((err) => {
        this.logger.error(`Failed to send Follow activity: ${err}`)
      })
    }

    // Emit event for notification creation
    this.eventEmitter.emit('user.followed', {
      actorId: followerId,
      followedUserId: followingUser.id,
      follow: {
        id: follow.id,
      },
    })

    return follow
  }

  /**
   * Unfollow a user (idempotent - safe to call multiple times)
   * @param followerId - Follower user ID
   * @param followingHandle - Username or username@domain to unfollow
   */
  async unfollowUser(followerId: string, followingHandle: string) {
    const { username, domain } = this.parseUserHandle(followingHandle)

    // Get following user by username and domain
    const followingUser = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain,
        },
      },
    })

    if (!followingUser) {
      throw new NotFoundException('User not found')
    }

    // Check if follow exists
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: followingUser.id,
        },
      },
    })

    if (!follow) {
      // Already not following - return success (idempotent)
      return { message: 'Unfollowed successfully' }
    }

    // Get follower user for activity delivery
    const followerUser = await this.prisma.user.findUnique({
      where: { id: followerId },
    })

    // Delete follow
    await this.prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: followingUser.id,
        },
      },
    })

    // Send Undo Follow activity to remote user's inbox
    if (domain && followingUser.inbox && followerUser) {
      this.activityDelivery.sendUndoFollow(followerUser, followingUser).catch((err) => {
        this.logger.error(`Failed to send Undo Follow activity: ${err}`)
      })
    }

    return { message: 'Unfollowed successfully' }
  }

  /**
   * Check if user is following another user
   * @param followerId - Follower user ID
   * @param followingHandle - Username or username@domain to check
   * @returns Follow status
   */
  async isFollowing(followerId: string, followingHandle: string) {
    const { username, domain } = this.parseUserHandle(followingHandle)

    const followingUser = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain,
        },
      },
    })

    if (!followingUser) {
      return { isFollowing: false, status: null }
    }

    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: followingUser.id,
        },
      },
    })

    return {
      isFollowing: !!follow,
      status: follow?.status || null,
    }
  }

  /**
   * Get followers of a user
   * @param handle - Username or username@domain
   * @param requesterId - ID of user making the request (to check follow status), null if unauthenticated
   * @param page - Page number
   * @param limit - Items per page
   * @returns List of followers
   */
  async getFollowers(
    handle: string,
    requesterId: string | null,
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
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const skip = (page - 1) * limit

    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: {
          followingId: user.id,
          status: FollowStatus.ACCEPTED,
        },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              domain: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              artworks: {
                take: 4,
                orderBy: { createdAt: 'desc' },
                where: {
                  visibility: 'PUBLIC',
                },
                include: {
                  images: {
                    take: 1,
                    orderBy: { order: 'asc' },
                    select: {
                      id: true,
                      thumbnailUrl: true,
                      width: true,
                      height: true,
                    },
                  },
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
      this.prisma.follow.count({
        where: {
          followingId: user.id,
          status: FollowStatus.ACCEPTED,
        },
      }),
    ])

    // Get requester's following list to check isFollowing status (only if authenticated)
    let followingIds = new Set<string>()
    if (requesterId) {
      const requesterFollowing = await this.prisma.follow.findMany({
        where: {
          followerId: requesterId,
          status: FollowStatus.ACCEPTED,
        },
        select: {
          followingId: true,
        },
      })
      followingIds = new Set(requesterFollowing.map((f) => f.followingId))
    }

    const followers = follows.map((follow) => ({
      ...follow.follower,
      isFollowing: requesterId ? followingIds.has(follow.follower.id) : false,
    }))

    return {
      followers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get users that a user is following
   * @param handle - Username or username@domain
   * @param requesterId - ID of user making the request (to check follow status), null if unauthenticated
   * @param page - Page number
   * @param limit - Items per page
   * @returns List of following users
   */
  async getFollowing(
    handle: string,
    requesterId: string | null,
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
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const skip = (page - 1) * limit

    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: {
          followerId: user.id,
          status: FollowStatus.ACCEPTED,
        },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              domain: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              artworks: {
                take: 4,
                orderBy: { createdAt: 'desc' },
                where: {
                  visibility: 'PUBLIC',
                },
                include: {
                  images: {
                    take: 1,
                    orderBy: { order: 'asc' },
                    select: {
                      id: true,
                      thumbnailUrl: true,
                      width: true,
                      height: true,
                    },
                  },
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
      this.prisma.follow.count({
        where: {
          followerId: user.id,
          status: FollowStatus.ACCEPTED,
        },
      }),
    ])

    // Get requester's following list to check isFollowing status (only if authenticated)
    let followingIds = new Set<string>()
    if (requesterId) {
      const requesterFollowing = await this.prisma.follow.findMany({
        where: {
          followerId: requesterId,
          status: FollowStatus.ACCEPTED,
        },
        select: {
          followingId: true,
        },
      })
      followingIds = new Set(requesterFollowing.map((f) => f.followingId))
    }

    const following = follows.map((follow) => ({
      ...follow.following,
      isFollowing: requesterId ? followingIds.has(follow.following.id) : false,
    }))

    return {
      following,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get follow counts for a user
   * @param handle - Username or username@domain
   * @returns Follower and following counts
   */
  async getFollowCounts(handle: string) {
    const { username, domain } = this.parseUserHandle(handle)

    const user = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain,
        },
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const [followersCount, followingCount] = await Promise.all([
      this.prisma.follow.count({
        where: {
          followingId: user.id,
          status: FollowStatus.ACCEPTED,
        },
      }),
      this.prisma.follow.count({
        where: {
          followerId: user.id,
          status: FollowStatus.ACCEPTED,
        },
      }),
    ])

    return {
      followersCount,
      followingCount,
    }
  }
}
