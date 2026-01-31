import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class BookmarksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Toggle bookmark on an artwork (bookmark if not bookmarked, unbookmark if already bookmarked)
   * @param userId - User ID
   * @param artworkId - Artwork ID
   * @returns Result with bookmarked status
   */
  async toggleBookmark(userId: string, artworkId: string) {
    // Check if already bookmarked
    const existingBookmark = await this.prisma.bookmark.findUnique({
      where: {
        userId_artworkId: {
          userId,
          artworkId,
        },
      },
    })

    if (existingBookmark) {
      // Unbookmark
      await this.unbookmarkArtwork(userId, artworkId)
      return { bookmarked: false, message: 'Bookmark removed successfully' }
    } else {
      // Bookmark
      const bookmark = await this.bookmarkArtwork(userId, artworkId)
      return { bookmarked: true, bookmark }
    }
  }

  /**
   * Bookmark an artwork (idempotent - safe to call multiple times)
   * @param userId - User ID
   * @param artworkId - Artwork ID
   * @returns Created bookmark
   */
  async bookmarkArtwork(userId: string, artworkId: string) {
    // Check if artwork exists
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    // Check if already bookmarked - return existing state instead of error
    const existingBookmark = await this.prisma.bookmark.findUnique({
      where: {
        userId_artworkId: {
          userId,
          artworkId,
        },
      },
    })

    if (existingBookmark) {
      // Already bookmarked - return success with current state (idempotent)
      return existingBookmark
    }

    // Create bookmark and increment bookmark count in a transaction
    const [bookmark] = await this.prisma.$transaction([
      this.prisma.bookmark.create({
        data: {
          userId,
          artworkId,
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
          bookmarkCount: {
            increment: 1,
          },
        },
      }),
    ])

    return bookmark
  }

  /**
   * Remove bookmark from an artwork (idempotent - safe to call multiple times)
   * @param userId - User ID
   * @param artworkId - Artwork ID
   */
  async unbookmarkArtwork(userId: string, artworkId: string) {
    // Check if bookmark exists
    const bookmark = await this.prisma.bookmark.findUnique({
      where: {
        userId_artworkId: {
          userId,
          artworkId,
        },
      },
    })

    if (!bookmark) {
      // Already not bookmarked - return success (idempotent)
      return { message: 'Bookmark removed successfully' }
    }

    // Delete bookmark and decrement bookmark count in a transaction
    await this.prisma.$transaction([
      this.prisma.bookmark.delete({
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
          bookmarkCount: {
            decrement: 1,
          },
        },
      }),
    ])

    return { message: 'Bookmark removed successfully' }
  }

  /**
   * Check if user bookmarked an artwork
   * @param userId - User ID
   * @param artworkId - Artwork ID
   * @returns Boolean indicating if bookmarked
   */
  async hasBookmarked(userId: string, artworkId: string): Promise<boolean> {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: {
        userId_artworkId: {
          userId,
          artworkId,
        },
      },
    })

    return !!bookmark
  }

  /**
   * Get user's bookmarked artworks
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns List of bookmarked artworks
   */
  async getUserBookmarkedArtworks(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit

    const [bookmarks, total] = await Promise.all([
      this.prisma.bookmark.findMany({
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
      this.prisma.bookmark.count({
        where: { userId },
      }),
    ])

    // Transform to artwork list format
    const artworks = bookmarks.map((bookmark) => ({
      ...bookmark.artwork,
      thumbnailUrl: bookmark.artwork.images[0]?.thumbnailUrl || '',
      tags: bookmark.artwork.tags.map((at) => at.tag),
    }))

    return {
      artworks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }
}
