import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActorService } from './actor.service'
import { FollowStatus } from '@prisma/client'
import {
  OrderedCollection,
  OrderedCollectionPage,
  AP_CONTEXT,
} from '@illo/shared'

/**
 * Followers Collection Service
 *
 * Exposes local user followers/following via ActivityPub endpoints
 */
@Injectable()
export class FollowersCollectionService {
  private readonly logger = new Logger(FollowersCollectionService.name)

  /**
   * Number of items per page
   */
  private readonly PAGE_SIZE = 20

  constructor(
    private readonly prisma: PrismaService,
    private readonly actorService: ActorService,
  ) {}

  /**
   * Get followers OrderedCollection (summary only)
   */
  async getFollowersCollection(username: string): Promise<OrderedCollection> {
    const publicUrl = await this.actorService.getPublicUrl()
    const followersUrl = `${publicUrl}/users/${username}/followers`

    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '', // Local users only
      },
    })

    if (!user) {
      throw new NotFoundException(`User not found: ${username}`)
    }

    const totalItems = await this.prisma.follow.count({
      where: {
        followingId: user.id,
        status: FollowStatus.ACCEPTED,
      },
    })

    return {
      '@context': AP_CONTEXT,
      id: followersUrl,
      type: 'OrderedCollection',
      totalItems,
      first: `${followersUrl}?page=true`,
    }
  }

  /**
   * Get a page of followers
   */
  async getFollowersPage(
    username: string,
    pageNum: number = 1,
  ): Promise<OrderedCollectionPage> {
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '', // Local users only
      },
    })

    if (!user) {
      throw new NotFoundException(`User not found: ${username}`)
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const followersUrl = `${publicUrl}/users/${username}/followers`

    const skip = (pageNum - 1) * this.PAGE_SIZE

    // Get followers with their actor URLs
    const follows = await this.prisma.follow.findMany({
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
            actorUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: this.PAGE_SIZE,
      skip,
    })

    const totalItems = await this.prisma.follow.count({
      where: {
        followingId: user.id,
        status: FollowStatus.ACCEPTED,
      },
    })

    // Convert to actor URLs
    const orderedItems = follows.map((follow) => {
      if (follow.follower.domain && follow.follower.actorUrl) {
        // Remote user - use their actorUrl
        return follow.follower.actorUrl
      } else {
        // Local user - construct local actor URL
        return `${publicUrl}/users/${follow.follower.username}`
      }
    })

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / this.PAGE_SIZE)
    const hasNext = pageNum < totalPages
    const hasPrev = pageNum > 1

    const page: OrderedCollectionPage = {
      '@context': AP_CONTEXT,
      id: `${followersUrl}?page=${pageNum}`,
      type: 'OrderedCollectionPage',
      totalItems,
      orderedItems: orderedItems as any[],
      partOf: followersUrl,
    }

    if (hasNext) {
      page.next = `${followersUrl}?page=${pageNum + 1}`
    }

    if (hasPrev) {
      page.prev = `${followersUrl}?page=${pageNum - 1}`
    }

    return page
  }

  /**
   * Get following OrderedCollection (summary only)
   */
  async getFollowingCollection(username: string): Promise<OrderedCollection> {
    const publicUrl = await this.actorService.getPublicUrl()
    const followingUrl = `${publicUrl}/users/${username}/following`

    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '', // Local users only
      },
    })

    if (!user) {
      throw new NotFoundException(`User not found: ${username}`)
    }

    const totalItems = await this.prisma.follow.count({
      where: {
        followerId: user.id,
        status: FollowStatus.ACCEPTED,
      },
    })

    return {
      '@context': AP_CONTEXT,
      id: followingUrl,
      type: 'OrderedCollection',
      totalItems,
      first: `${followingUrl}?page=true`,
    }
  }

  /**
   * Get a page of following
   */
  async getFollowingPage(
    username: string,
    pageNum: number = 1,
  ): Promise<OrderedCollectionPage> {
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '', // Local users only
      },
    })

    if (!user) {
      throw new NotFoundException(`User not found: ${username}`)
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const followingUrl = `${publicUrl}/users/${username}/following`

    const skip = (pageNum - 1) * this.PAGE_SIZE

    // Get following with their actor URLs
    const follows = await this.prisma.follow.findMany({
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
            actorUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: this.PAGE_SIZE,
      skip,
    })

    const totalItems = await this.prisma.follow.count({
      where: {
        followerId: user.id,
        status: FollowStatus.ACCEPTED,
      },
    })

    // Convert to actor URLs
    const orderedItems = follows.map((follow) => {
      if (follow.following.domain && follow.following.actorUrl) {
        // Remote user - use their actorUrl
        return follow.following.actorUrl
      } else {
        // Local user - construct local actor URL
        return `${publicUrl}/users/${follow.following.username}`
      }
    })

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / this.PAGE_SIZE)
    const hasNext = pageNum < totalPages
    const hasPrev = pageNum > 1

    const page: OrderedCollectionPage = {
      '@context': AP_CONTEXT,
      id: `${followingUrl}?page=${pageNum}`,
      type: 'OrderedCollectionPage',
      totalItems,
      orderedItems: orderedItems as any[],
      partOf: followingUrl,
    }

    if (hasNext) {
      page.next = `${followingUrl}?page=${pageNum + 1}`
    }

    if (hasPrev) {
      page.prev = `${followingUrl}?page=${pageNum - 1}`
    }

    return page
  }
}
