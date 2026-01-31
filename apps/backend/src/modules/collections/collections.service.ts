import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCollectionDto } from './dto/create-collection.dto'
import { UpdateCollectionDto } from './dto/update-collection.dto'
import { Visibility } from '@prisma/client'

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new collection
   */
  async createCollection(userId: string, dto: CreateCollectionDto) {
    // Get user's default visibility if not specified
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultVisibility: true },
    })

    const collection = await this.prisma.collection.create({
      data: {
        title: dto.title,
        description: dto.description,
        visibility: dto.visibility || user?.defaultVisibility || Visibility.PUBLIC,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            domain: true,
          },
        },
        artworks: {
          include: {
            artwork: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    return collection
  }

  /**
   * Get all collections for a user
   */
  async getUserCollections(username: string, domain: string = '', currentUserId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, domain },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const isOwner = currentUserId === user.id

    // Build visibility filter
    const visibilityFilter: Visibility[] = [Visibility.PUBLIC, Visibility.UNLISTED]
    if (isOwner) {
      visibilityFilter.push(Visibility.FOLLOWERS_ONLY, Visibility.PRIVATE)
    } else if (currentUserId) {
      // Check if current user follows this user
      const isFollower = await this.prisma.follow.findFirst({
        where: {
          followerId: currentUserId,
          followingId: user.id,
          status: 'ACCEPTED',
        },
      })
      if (isFollower) {
        visibilityFilter.push(Visibility.FOLLOWERS_ONLY)
      }
    }

    const collections = await this.prisma.collection.findMany({
      where: {
        userId: user.id,
        visibility: { in: visibilityFilter },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            domain: true,
          },
        },
        artworks: {
          include: {
            artwork: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { order: 'asc' },
          take: 4, // Get first 4 for cover preview
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return collections
  }

  /**
   * Get current user's collections (for adding artworks)
   */
  async getMyCollections(userId: string) {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      include: {
        artworks: {
          select: {
            artworkId: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return collections.map((c) => ({
      id: c.id,
      title: c.title,
      artworkCount: c.artworkCount,
      artworkIds: c.artworks.map((a) => a.artworkId),
    }))
  }

  /**
   * Get a single collection by ID
   */
  async getCollectionById(collectionId: string, currentUserId?: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            domain: true,
          },
        },
        artworks: {
          include: {
            artwork: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                },
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    domain: true,
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!collection) {
      throw new NotFoundException('Collection not found')
    }

    // Check visibility
    const isOwner = currentUserId === collection.userId
    if (!isOwner) {
      if (collection.visibility === Visibility.PRIVATE) {
        throw new ForbiddenException('This collection is private')
      }
      if (collection.visibility === Visibility.FOLLOWERS_ONLY) {
        if (!currentUserId) {
          throw new ForbiddenException('This collection is for followers only')
        }
        const isFollower = await this.prisma.follow.findFirst({
          where: {
            followerId: currentUserId,
            followingId: collection.userId,
            status: 'ACCEPTED',
          },
        })
        if (!isFollower) {
          throw new ForbiddenException('This collection is for followers only')
        }
      }
    }

    return collection
  }

  /**
   * Update a collection
   */
  async updateCollection(collectionId: string, userId: string, dto: UpdateCollectionDto) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    })

    if (!collection) {
      throw new NotFoundException('Collection not found')
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only edit your own collections')
    }

    const updated = await this.prisma.collection.update({
      where: { id: collectionId },
      data: {
        title: dto.title,
        description: dto.description,
        visibility: dto.visibility,
        coverImageUrl: dto.coverImageUrl,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            domain: true,
          },
        },
        artworks: {
          include: {
            artwork: {
              include: {
                images: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    return updated
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionId: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    })

    if (!collection) {
      throw new NotFoundException('Collection not found')
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only delete your own collections')
    }

    await this.prisma.collection.delete({
      where: { id: collectionId },
    })

    return { message: 'Collection deleted successfully' }
  }

  /**
   * Add artwork to collection
   */
  async addArtworkToCollection(collectionId: string, artworkId: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    })

    if (!collection) {
      throw new NotFoundException('Collection not found')
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only add artworks to your own collections')
    }

    // Check if artwork exists
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    // Check if already in collection
    const existing = await this.prisma.collectionArtwork.findUnique({
      where: {
        collectionId_artworkId: {
          collectionId,
          artworkId,
        },
      },
    })

    if (existing) {
      throw new BadRequestException('Artwork is already in this collection')
    }

    // Get the next order value
    const maxOrder = await this.prisma.collectionArtwork.findFirst({
      where: { collectionId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const [collectionArtwork] = await this.prisma.$transaction([
      this.prisma.collectionArtwork.create({
        data: {
          collectionId,
          artworkId,
          order: (maxOrder?.order ?? -1) + 1,
        },
        include: {
          artwork: {
            include: {
              images: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      }),
      this.prisma.collection.update({
        where: { id: collectionId },
        data: {
          artworkCount: { increment: 1 },
        },
      }),
    ])

    return collectionArtwork
  }

  /**
   * Remove artwork from collection
   */
  async removeArtworkFromCollection(collectionId: string, artworkId: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    })

    if (!collection) {
      throw new NotFoundException('Collection not found')
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only remove artworks from your own collections')
    }

    const collectionArtwork = await this.prisma.collectionArtwork.findUnique({
      where: {
        collectionId_artworkId: {
          collectionId,
          artworkId,
        },
      },
    })

    if (!collectionArtwork) {
      throw new NotFoundException('Artwork not found in this collection')
    }

    await this.prisma.$transaction([
      this.prisma.collectionArtwork.delete({
        where: { id: collectionArtwork.id },
      }),
      this.prisma.collection.update({
        where: { id: collectionId },
        data: {
          artworkCount: { decrement: 1 },
        },
      }),
    ])

    return { message: 'Artwork removed from collection' }
  }

  /**
   * Reorder artworks in collection
   */
  async reorderCollectionArtworks(collectionId: string, artworkIds: string[], userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    })

    if (!collection) {
      throw new NotFoundException('Collection not found')
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You can only reorder your own collections')
    }

    // Update order for each artwork
    await this.prisma.$transaction(
      artworkIds.map((artworkId, index) =>
        this.prisma.collectionArtwork.updateMany({
          where: {
            collectionId,
            artworkId,
          },
          data: {
            order: index,
          },
        }),
      ),
    )

    return { message: 'Collection reordered successfully' }
  }
}
