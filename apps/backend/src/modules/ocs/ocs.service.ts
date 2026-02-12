import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateOCDto } from './dto/create-oc.dto'
import { UpdateOCDto } from './dto/update-oc.dto'
import { OCQueryDto } from './dto/oc-query.dto'
import { FanArtPermission, Visibility } from '@prisma/client'

// Include for representative artwork with first image
const representativeArtworkInclude = {
  representativeArtwork: {
    select: {
      id: true,
      title: true,
      images: {
        take: 1,
        orderBy: { order: 'asc' as const },
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
        },
      },
    },
  },
}

@Injectable()
export class OCsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new original character
   */
  async create(userId: string, dto: CreateOCDto) {
    // Validate representative artwork if provided
    if (dto.representativeArtworkId) {
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: dto.representativeArtworkId },
      })
      if (!artwork) {
        throw new BadRequestException('Representative artwork not found')
      }
      if (artwork.authorId !== userId) {
        throw new ForbiddenException('You can only use your own artworks as representative')
      }
    }

    const character = await this.prisma.originalCharacter.create({
      data: {
        creatorId: userId,
        name: dto.name,
        description: dto.description,
        representativeArtworkId: dto.representativeArtworkId,
        allowFanArt: dto.allowFanArt ?? true,
        fanArtPermission: dto.fanArtPermission ?? FanArtPermission.EVERYONE,
        allowR18: dto.allowR18 ?? false,
        allowCommercial: dto.allowCommercial ?? false,
        requireCredit: dto.requireCredit ?? true,
        guidelines: dto.guidelines,
        referenceNotes: dto.referenceNotes,
        referenceVisibility: dto.referenceVisibility ?? Visibility.PUBLIC,
        tags: dto.tags ?? [],
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            domain: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        ...representativeArtworkInclude,
      },
    })

    return character
  }

  /**
   * Get a list of original characters with filtering
   */
  async findAll(query: OCQueryDto, currentUserId?: string) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: any = {}

    // Filter by fan art welcome
    if (query.fanArtWelcome !== undefined) {
      where.allowFanArt = query.fanArtWelcome
    }

    // Filter by fan art permission
    if (query.fanArtPermission) {
      where.fanArtPermission = query.fanArtPermission
    }

    // Search by name
    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      }
    }

    const [characters, total] = await Promise.all([
      this.prisma.originalCharacter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              domain: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          ...representativeArtworkInclude,
          _count: {
            select: {
              fanArts: true,
            },
          },
        },
      }),
      this.prisma.originalCharacter.count({ where }),
    ])

    return {
      characters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get fan art welcome characters for home page
   */
  async findFanArtWelcome(limit: number = 8) {
    const characters = await this.prisma.originalCharacter.findMany({
      where: {
        allowFanArt: true,
        fanArtPermission: FanArtPermission.EVERYONE,
      },
      take: limit,
      orderBy: [{ fanArtCount: 'desc' }, { createdAt: 'desc' }],
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            domain: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        ...representativeArtworkInclude,
      },
    })

    return characters
  }

  /**
   * Get a single original character by ID
   */
  async findOne(id: string, currentUserId?: string) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            domain: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
          },
        },
        ...representativeArtworkInclude,
        referenceArtworks: {
          orderBy: { order: 'asc' },
          include: {
            artwork: {
              select: {
                id: true,
                title: true,
                images: {
                  take: 1,
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    url: true,
                    thumbnailUrl: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            fanArts: true,
          },
        },
      },
    })

    if (!character) {
      throw new NotFoundException('Character not found')
    }

    // Check visibility for reference artworks
    let referenceArtworks = character.referenceArtworks
    let referenceNotes = character.referenceNotes

    if (
      character.referenceVisibility === Visibility.FOLLOWERS_ONLY &&
      currentUserId !== character.creatorId
    ) {
      // Check if current user follows the creator
      if (currentUserId) {
        const follows = await this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: character.creatorId,
            },
          },
        })
        if (!follows || follows.status !== 'ACCEPTED') {
          referenceArtworks = []
          referenceNotes = null
        }
      } else {
        referenceArtworks = []
        referenceNotes = null
      }
    } else if (
      character.referenceVisibility === Visibility.PRIVATE &&
      currentUserId !== character.creatorId
    ) {
      referenceArtworks = []
      referenceNotes = null
    }

    return {
      ...character,
      referenceArtworks,
      referenceNotes,
    }
  }

  /**
   * Get characters by user
   */
  async findByUser(username: string, query: OCQueryDto, currentUserId?: string) {
    const page = query.page ?? 1
    const limit = Math.min(query.limit ?? 20, 100)
    const skip = (page - 1) * limit

    // Find the user
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '',
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const where: any = {
      creatorId: user.id,
    }

    // Filter by fan art welcome if specified
    if (query.fanArtWelcome !== undefined) {
      where.allowFanArt = query.fanArtWelcome
    }

    const [characters, total] = await Promise.all([
      this.prisma.originalCharacter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              domain: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          ...representativeArtworkInclude,
          _count: {
            select: {
              fanArts: true,
            },
          },
        },
      }),
      this.prisma.originalCharacter.count({ where }),
    ])

    return {
      characters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Update an original character
   */
  async update(id: string, userId: string, dto: UpdateOCDto) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id },
    })

    if (!character) {
      throw new NotFoundException('Character not found')
    }

    if (character.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own characters')
    }

    // Validate representative artwork if being updated
    if (dto.representativeArtworkId !== undefined) {
      if (dto.representativeArtworkId !== null) {
        const artwork = await this.prisma.artwork.findUnique({
          where: { id: dto.representativeArtworkId },
        })
        if (!artwork) {
          throw new BadRequestException('Representative artwork not found')
        }
        if (artwork.authorId !== userId) {
          throw new ForbiddenException('You can only use your own artworks as representative')
        }
      }
    }

    const updated = await this.prisma.originalCharacter.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        representativeArtworkId: dto.representativeArtworkId,
        allowFanArt: dto.allowFanArt,
        fanArtPermission: dto.fanArtPermission,
        allowR18: dto.allowR18,
        allowCommercial: dto.allowCommercial,
        requireCredit: dto.requireCredit,
        guidelines: dto.guidelines,
        referenceNotes: dto.referenceNotes,
        referenceVisibility: dto.referenceVisibility,
        tags: dto.tags,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            domain: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        ...representativeArtworkInclude,
      },
    })

    return updated
  }

  /**
   * Delete an original character
   */
  async remove(id: string, userId: string) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id },
    })

    if (!character) {
      throw new NotFoundException('Character not found')
    }

    if (character.creatorId !== userId) {
      throw new ForbiddenException('You can only delete your own characters')
    }

    await this.prisma.originalCharacter.delete({
      where: { id },
    })

    return { success: true }
  }

  /**
   * Set representative artwork for character
   */
  async setRepresentativeArtwork(
    characterId: string,
    userId: string,
    artworkId: string | null
  ) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id: characterId },
    })

    if (!character) {
      throw new NotFoundException('Character not found')
    }

    if (character.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own characters')
    }

    // Validate artwork if provided
    if (artworkId) {
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: artworkId },
      })
      if (!artwork) {
        throw new BadRequestException('Artwork not found')
      }
      if (artwork.authorId !== userId) {
        throw new ForbiddenException('You can only use your own artworks')
      }
    }

    const updated = await this.prisma.originalCharacter.update({
      where: { id: characterId },
      data: {
        representativeArtworkId: artworkId,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            domain: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        ...representativeArtworkInclude,
      },
    })

    return updated
  }

  /**
   * Add reference artwork to character
   */
  async addReferenceArtwork(
    characterId: string,
    userId: string,
    artworkId: string,
    caption?: string
  ) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id: characterId },
    })

    if (!character) {
      throw new NotFoundException('Character not found')
    }

    if (character.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own characters')
    }

    // Validate artwork
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
    })
    if (!artwork) {
      throw new BadRequestException('Artwork not found')
    }
    if (artwork.authorId !== userId) {
      throw new ForbiddenException('You can only use your own artworks as references')
    }

    // Check if already added
    const existing = await this.prisma.characterReferenceArtwork.findUnique({
      where: {
        characterId_artworkId: {
          characterId,
          artworkId,
        },
      },
    })
    if (existing) {
      throw new BadRequestException('Artwork already added as reference')
    }

    // Get current max order
    const maxOrder = await this.prisma.characterReferenceArtwork.aggregate({
      where: { characterId },
      _max: { order: true },
    })

    const reference = await this.prisma.characterReferenceArtwork.create({
      data: {
        characterId,
        artworkId,
        caption,
        order: (maxOrder._max.order ?? -1) + 1,
      },
      include: {
        artwork: {
          select: {
            id: true,
            title: true,
            images: {
              take: 1,
              orderBy: { order: 'asc' },
              select: {
                id: true,
                url: true,
                thumbnailUrl: true,
              },
            },
          },
        },
      },
    })

    return reference
  }

  /**
   * Remove reference artwork from character
   */
  async removeReferenceArtwork(
    characterId: string,
    artworkId: string,
    userId: string
  ) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id: characterId },
    })

    if (!character) {
      throw new NotFoundException('Character not found')
    }

    if (character.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own characters')
    }

    const reference = await this.prisma.characterReferenceArtwork.findUnique({
      where: {
        characterId_artworkId: {
          characterId,
          artworkId,
        },
      },
    })

    if (!reference) {
      throw new NotFoundException('Reference not found')
    }

    await this.prisma.characterReferenceArtwork.delete({
      where: {
        characterId_artworkId: {
          characterId,
          artworkId,
        },
      },
    })

    return { success: true }
  }

  /**
   * Reorder reference artworks
   */
  async reorderReferenceArtworks(
    characterId: string,
    userId: string,
    artworkIds: string[]
  ) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id: characterId },
    })

    if (!character) {
      throw new NotFoundException('Character not found')
    }

    if (character.creatorId !== userId) {
      throw new ForbiddenException('You can only update your own characters')
    }

    // Update order for each reference
    await Promise.all(
      artworkIds.map((artworkId, index) =>
        this.prisma.characterReferenceArtwork.updateMany({
          where: {
            characterId,
            artworkId,
          },
          data: {
            order: index,
          },
        })
      )
    )

    return { success: true }
  }

  /**
   * Get fan arts for a character
   */
  async getFanArts(characterId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit

    const [artworks, total] = await Promise.all([
      this.prisma.artwork.findMany({
        where: {
          characterId,
          visibility: Visibility.PUBLIC,
          isDeleted: false,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              domain: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          images: {
            take: 1,
            orderBy: { order: 'asc' },
            select: {
              id: true,
              url: true,
              thumbnailUrl: true,
            },
          },
        },
      }),
      this.prisma.artwork.count({
        where: {
          characterId,
          visibility: Visibility.PUBLIC,
          isDeleted: false,
        },
      }),
    ])

    return {
      artworks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Increment fan art count for a character
   */
  async incrementFanArtCount(characterId: string) {
    await this.prisma.originalCharacter.update({
      where: { id: characterId },
      data: {
        fanArtCount: { increment: 1 },
      },
    })
  }

  /**
   * Decrement fan art count for a character
   */
  async decrementFanArtCount(characterId: string) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id: characterId },
    })
    if (character && character.fanArtCount > 0) {
      await this.prisma.originalCharacter.update({
        where: { id: characterId },
        data: {
          fanArtCount: { decrement: 1 },
        },
      })
    }
  }

  /**
   * Get creator's artworks (for empty fan art state)
   */
  async getCreatorArtworks(characterId: string, limit: number = 4) {
    const character = await this.prisma.originalCharacter.findUnique({
      where: { id: characterId },
      include: {
        referenceArtworks: {
          select: { artworkId: true },
        },
      },
    })

    if (!character) {
      throw new NotFoundException('Character not found')
    }

    // Exclude representative artwork and reference artworks
    const excludeIds: string[] = []
    if (character.representativeArtworkId) {
      excludeIds.push(character.representativeArtworkId)
    }
    character.referenceArtworks.forEach((ref) => {
      excludeIds.push(ref.artworkId)
    })

    const artworks = await this.prisma.artwork.findMany({
      where: {
        authorId: character.creatorId,
        visibility: Visibility.PUBLIC,
        isDeleted: false,
        id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            domain: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        images: {
          take: 1,
          orderBy: { order: 'asc' },
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
          },
        },
      },
    })

    return artworks
  }
}
