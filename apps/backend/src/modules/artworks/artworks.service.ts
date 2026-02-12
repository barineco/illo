import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { ImageSigningService } from '../storage/image-signing.service'
import { RemoteArtworkService } from '../federation/services/remote-artwork.service'
import { ActivityDeliveryService } from '../federation/services/activity-delivery.service'
import { RemoteFetchService } from '../federation/services/remote-fetch.service'
import { InboxService } from '../federation/services/inbox.service'
import { ActorService } from '../federation/services/actor.service'
import { MutesService } from '../mutes/mutes.service'
import { ContentFilters } from '../users/users.service'
import { ArtworkType, AgeRating, Visibility, Prisma, CreationPeriodUnit, ArtworkMedium, CopyrightType } from '@prisma/client'

export interface CreateArtworkDto {
  title: string
  description?: string
  type: ArtworkType
  ageRating: AgeRating
  visibility?: Visibility
  tags?: string[]
  disableRightClick?: boolean
  license?: string  // Artwork-specific license (e.g., "CC BY 4.0", "All Rights Reserved")
  customLicenseUrl?: string  // Custom license URL
  customLicenseText?: string  // Custom license text description
  // Creation metadata (portfolio fields)
  creationDate?: Date | string
  creationPeriodValue?: number
  creationPeriodUnit?: CreationPeriodUnit
  isCommission?: boolean
  clientName?: string
  projectName?: string
  medium?: ArtworkMedium
  externalUrl?: string
  toolsUsed?: string[]  // Array of tool names
  // OG card crop coordinates (for link card from first image)
  ogCardCrop?: { x: number; y: number; width: number; height: number }
  ogCardBlur?: boolean
  // Copyright/Rights holder information
  copyrightHolder?: string
  copyrightType?: CopyrightType
  copyrightNote?: string
  // Fan art original creator linking
  originalCreatorId?: string
  originalCreatorAllowDownload?: boolean
  // Fan art character linking
  characterId?: string  // ID of the original character for fan art
  // Collection integration
  collectionIds?: string[]  // IDs of existing collections to add artwork to
}

export interface ImageOperation {
  type: 'keep' | 'delete' | 'add'
  id?: string // ID of existing image (for keep/delete)
  order: number // New display order
}

export interface UpdateArtworkDto {
  title?: string
  description?: string
  type?: ArtworkType
  ageRating?: AgeRating
  visibility?: Visibility
  tags?: string[]
  imageOperations?: ImageOperation[]
  disableRightClick?: boolean
  license?: string  // Artwork-specific license
  customLicenseUrl?: string  // Custom license URL
  customLicenseText?: string  // Custom license text description
  // Creation metadata (portfolio fields)
  creationDate?: Date | string | null
  creationPeriodValue?: number | null
  creationPeriodUnit?: CreationPeriodUnit | null
  isCommission?: boolean
  clientName?: string | null
  projectName?: string | null
  medium?: ArtworkMedium | null
  externalUrl?: string | null
  toolsUsed?: string[] | null  // Array of tool names
  // OG card crop coordinates (for link card from first image)
  ogCardCrop?: { x: number; y: number; width: number; height: number } | null
  ogCardBlur?: boolean
  // Copyright/Rights holder information
  copyrightHolder?: string | null
  copyrightType?: CopyrightType
  copyrightNote?: string | null
  // Fan art original creator linking
  originalCreatorId?: string | null
  originalCreatorAllowDownload?: boolean
  // Fan art character linking
  characterId?: string | null  // ID of the original character for fan art
}

export interface OgCardCropRegion {
  x: number       // X offset in pixels (on original image)
  y: number       // Y offset in pixels
  width: number   // Crop width in pixels
  height: number  // Crop height in pixels
}

export interface GenerateOgCardDto {
  imageId: string                  // Which artwork image to use
  cropRegion?: OgCardCropRegion   // Optional, defaults to center crop
  blur?: boolean                   // Optional, auto-enabled for R18/R18G
}

export interface ArtworkQueryParams {
  page?: number
  limit?: number
  q?: string // Full-text search query
  type?: ArtworkType
  ageRating?: AgeRating
  tags?: string[]
  authorId?: string
  sort?: 'latest' | 'popular' | 'views' | 'creationDateDesc' | 'creationDateAsc'
  federation?: 'local' | 'remote' | 'all'
  currentUserId?: string // For mute filtering
  contentFilters?: ContentFilters // User's content filter settings
}

// Common select objects for Prisma queries
const ARTWORK_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  visibility: true,
  ageRating: true,
  images: {
    orderBy: { order: 'asc' as const },
    take: 4, // Get up to 4 images for preview on hover
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      order: true,
    },
  },
  author: {
    select: {
      id: true,
      username: true,
      domain: true,
      displayName: true,
      avatarUrl: true,
      supporterTier: true,
    },
  },
  _count: {
    select: {
      likes: true,
      bookmarks: true,
      images: true, // Total image count
    },
  },
} satisfies Prisma.ArtworkSelect

const ARTWORK_DETAIL_INCLUDE = {
  images: {
    orderBy: { order: 'asc' as const },
  },
  author: {
    select: {
      id: true,
      username: true,
      domain: true,
      displayName: true,
      avatarUrl: true,
      isVerified: true,
    },
  },
  originalCreator: {
    select: {
      id: true,
      username: true,
      domain: true,
      displayName: true,
      avatarUrl: true,
    },
  },
  tags: {
    include: {
      tag: true,
    },
  },
  _count: {
    select: {
      likes: true,
      bookmarks: true,
      comments: true,
    },
  },
} satisfies Prisma.ArtworkInclude

@Injectable()
export class ArtworksService {
  private readonly logger = new Logger(ArtworksService.name)

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private imageSigningService: ImageSigningService,
    private remoteArtworkService: RemoteArtworkService,
    private activityDeliveryService: ActivityDeliveryService,
    private remoteFetchService: RemoteFetchService,
    private inboxService: InboxService,
    private actorService: ActorService,
    private mutesService: MutesService,
  ) {}

  /**
   * Apply signed URLs to artwork images if signing is enabled
   * This transforms stored URLs to time-limited signed URLs for the API response
   */
  private applySignedUrls<T extends { images?: Array<{ id: string; url: string; thumbnailUrl: string }> }>(artwork: T): T {
    if (!this.imageSigningService.isEnabled() || !artwork.images) {
      return artwork
    }

    return {
      ...artwork,
      images: artwork.images.map(image => ({
        ...image,
        url: this.imageSigningService.generateSignedUrlV2(image.id, 'standard').url,
        thumbnailUrl: this.imageSigningService.generateSignedUrlV2(image.id, 'thumbnail').url,
      })),
    }
  }

  /**
   * Apply signed URL to a single image for thumbnail display
   */
  private applySignedThumbnailUrl<T extends { thumbnailUrl?: string; images?: Array<{ id: string }> }>(artwork: T): T {
    if (!this.imageSigningService.isEnabled()) {
      return artwork
    }

    // If artwork has images array with first image, generate signed URL for thumbnail
    if (artwork.images && artwork.images.length > 0) {
      const firstImageId = artwork.images[0].id
      return {
        ...artwork,
        thumbnailUrl: this.imageSigningService.generateSignedUrlV2(firstImageId, 'thumbnail').url,
      }
    }

    return artwork
  }

  /**
   * Create new artwork with images
   */
  async createArtwork(
    authorId: string,
    createDto: CreateArtworkDto,
    imageFiles: Express.Multer.File[],
  ) {
    if (!imageFiles || imageFiles.length === 0) {
      throw new Error('At least one image is required')
    }

    // Get author info for metadata, default visibility, tier limits, and storage quota
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: {
        username: true,
        displayName: true,
        defaultVisibility: true,
        defaultLicense: true,
        supporterTier: true,
        role: true,
        usedStorageBytes: true,
        storageQuotaBytes: true,
      },
    })

    if (!author) {
      throw new NotFoundException('Author not found')
    }

    // Check image count against tier limit (Admin gets TIER_1 limit)
    const { getMaxImagesPerArtwork, getStorageQuota } = await import('../../common/constants/supporter-tiers')
    const effectiveTier = author.role === 'ADMIN' ? 'TIER_1' : author.supporterTier
    const maxImages = getMaxImagesPerArtwork(effectiveTier)

    if (imageFiles.length > maxImages) {
      throw new BadRequestException(`Maximum ${maxImages} images allowed per artwork for your tier`)
    }

    // Check storage quota against tier limit (Admin gets TIER_1 quota)
    const storageQuota = getStorageQuota(effectiveTier)
    const totalUploadSize = imageFiles.reduce((sum, file) => sum + file.size, 0)

    if (author.usedStorageBytes + BigInt(totalUploadSize) > storageQuota) {
      throw new ForbiddenException(`Storage quota exceeded. You have used ${Number(author.usedStorageBytes / BigInt(1024 * 1024))}MB of your ${Number(storageQuota / BigInt(1024 * 1024))}MB quota`)
    }

    // Determine visibility
    const visibility = createDto.visibility || author.defaultVisibility || 'PUBLIC'

    // Upload all images with format preservation and metadata
    const encryptionEnabled = this.storageService.isEncryptionEnabled()

    // Note: We need the artwork URL for metadata, but we don't have the artwork ID yet
    // We'll generate a placeholder URL and update it after the artwork is created
    const baseUrl = process.env.BASE_URL || 'http://localhost:11104'

    const uploadPromises = imageFiles.map(async (file, index) => {
      // Temporary placeholder URL (will be updated after artwork creation)
      const metadataInput = {
        username: author.username,
        displayName: author.displayName || undefined,
        artworkTitle: createDto.title,
        artworkUrl: `${baseUrl}/artworks/pending`, // Placeholder
        license: createDto.license || author.defaultLicense || undefined,
        customLicenseUrl: createDto.customLicenseUrl || undefined,
        // Extended creation metadata
        creationDate: createDto.creationDate || undefined,
        toolsUsed: createDto.toolsUsed || undefined,
        medium: createDto.medium || undefined,
        projectName: createDto.projectName || undefined,
        isCommission: createDto.isCommission || false,
        clientName: createDto.clientName || undefined,
      }

      const result = await this.storageService.uploadArtworkImage(file, 'artworks', metadataInput)

      return {
        // URL and thumbnailUrl will be set after DB insert when we have the image ID
        url: '', // Placeholder - will be updated after DB insert
        thumbnailUrl: '', // Placeholder - will be updated after DB insert
        width: result.standard.width,
        height: result.standard.height,
        // Store original dimensions for ActivityPub federation
        originalWidth: result.original?.width || result.standard.width,
        originalHeight: result.original?.height || result.standard.height,
        order: index,
        // Storage keys
        storageKey: result.standard.key,
        originalStorageKey: result.original?.key || null,
        // File sizes
        fileSize: result.standard.size,
        originalFileSize: result.original?.size || null,
        mimeType: result.standard.contentType,
        // Format and metadata info
        originalFormat: result.originalFormat,
        hasMetadata: result.hasMetadata,
        wasResized: result.wasResized,
        // Store encryption IVs if encryption is enabled
        encryptionIv: result.standard.encryptionIv || null,
        originalEncryptionIv: result.original?.encryptionIv || null,
        thumbnailEncryptionIv: result.thumbnail.encryptionIv || null,
        isEncrypted: encryptionEnabled,
      }
    })

    const uploadedImages = await Promise.all(uploadPromises)

    // Create artwork with images and tags in a transaction
    const artwork = await this.prisma.$transaction(async (tx) => {
      // Create artwork
      const newArtwork = await tx.artwork.create({
        data: {
          title: createDto.title,
          description: createDto.description,
          type: createDto.type,
          ageRating: createDto.ageRating,
          visibility: visibility,
          disableRightClick: createDto.disableRightClick ?? true,
          license: createDto.license || null,
          customLicenseUrl: createDto.customLicenseUrl || null,
          customLicenseText: createDto.customLicenseText || null,
          // Creation metadata (portfolio fields)
          creationDate: createDto.creationDate ? new Date(createDto.creationDate) : null,
          creationPeriodValue: createDto.creationPeriodValue ?? null,
          creationPeriodUnit: createDto.creationPeriodUnit ?? null,
          isCommission: createDto.isCommission ?? false,
          clientName: createDto.clientName || null,
          projectName: createDto.projectName || null,
          medium: createDto.medium ?? null,
          externalUrl: createDto.externalUrl || null,
          toolsUsed: createDto.toolsUsed ? JSON.stringify(createDto.toolsUsed) : null,
          // OG card crop coordinates (stored in original image pixels)
          ogCardCropX: createDto.ogCardCrop?.x ?? null,
          ogCardCropY: createDto.ogCardCrop?.y ?? null,
          ogCardCropWidth: createDto.ogCardCrop?.width ?? null,
          ogCardCropHeight: createDto.ogCardCrop?.height ?? null,
          ogCardBlur: createDto.ogCardBlur ?? false,
          // Copyright/Rights holder information
          copyrightHolder: createDto.copyrightHolder || null,
          copyrightType: createDto.copyrightType ?? 'CREATOR',
          copyrightNote: createDto.copyrightNote || null,
          // Fan art original creator linking
          originalCreatorId: createDto.originalCreatorId || null,
          originalCreatorAllowDownload: createDto.originalCreatorAllowDownload ?? false,
          // Fan art character linking
          characterId: createDto.characterId || null,
          authorId: authorId,
          images: {
            create: uploadedImages,
          },
        },
        include: {
          images: {
            orderBy: { order: 'asc' },
          },
          author: {
            select: {
              id: true,
              username: true,
              domain: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      })

      // Handle tags if provided
      if (createDto.tags && createDto.tags.length > 0) {
        for (const tagName of createDto.tags) {
          // Find or create tag
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          })

          // Link tag to artwork
          await tx.artworkTag.create({
            data: {
              artworkId: newArtwork.id,
              tagId: tag.id,
            },
          })
        }
      }

      // Now update image URLs with actual image IDs
      // For encrypted images, use proxy API URLs; for unencrypted, use direct MinIO URLs
      for (const image of newArtwork.images) {
        let url: string
        let thumbnailUrl: string

        if (encryptionEnabled) {
          // Use proxy API URLs
          url = this.storageService.getImageUrl(image.id, false)
          thumbnailUrl = this.storageService.getImageUrl(image.id, true)
        } else {
          // Use direct MinIO URLs
          url = this.storageService.getDirectImageUrl(image.storageKey)
          // Thumbnail key is derived from storage key
          const thumbKey = image.storageKey.replace('-original-', '-thumb-')
          thumbnailUrl = this.storageService.getDirectImageUrl(thumbKey)
        }

        await tx.artworkImage.update({
          where: { id: image.id },
          data: { url, thumbnailUrl },
        })
      }

      return newArtwork
    })

    // Fetch full artwork with relations for ActivityPub delivery
    const fullArtwork = await this.prisma.artwork.findUnique({
      where: { id: artwork.id },
      include: {
        images: { orderBy: { order: 'asc' } },
        tags: { include: { tag: true } },
        author: true,
      },
    })

    // Send Create Activity to followers (async, don't block response)
    // Only for local users and non-PRIVATE artworks
    if (fullArtwork && fullArtwork.author.domain === '') {
      this.activityDeliveryService
        .sendCreateArtwork(fullArtwork.author, fullArtwork)
        .catch((err) => this.logger.error(`Failed to send Create Activity: ${err.message}`))
    }

    // Add artwork to collections if specified
    if (createDto.collectionIds && createDto.collectionIds.length > 0) {
      for (const collectionId of createDto.collectionIds) {
        try {
          // Verify collection belongs to the author
          const collection = await this.prisma.collection.findFirst({
            where: {
              id: collectionId,
              userId: authorId,
            },
          })

          if (collection) {
            await this.prisma.collectionArtwork.create({
              data: {
                collectionId,
                artworkId: artwork.id,
              },
            })

            // Update collection's artwork count
            await this.prisma.collection.update({
              where: { id: collectionId },
              data: { artworkCount: { increment: 1 } },
            })
          }
        } catch (error) {
          // Log but don't fail the whole operation
          this.logger.warn(`Failed to add artwork to collection ${collectionId}: ${error.message}`)
        }
      }
    }

    // Handle character fan art linking
    if (createDto.characterId) {
      try {
        // Get character to find creator
        const character = await this.prisma.originalCharacter.findUnique({
          where: { id: createDto.characterId },
          select: { id: true, creatorId: true, name: true },
        })

        if (character) {
          // Increment fan art count
          await this.prisma.originalCharacter.update({
            where: { id: character.id },
            data: { fanArtCount: { increment: 1 } },
          })

          // Create notification for character creator (if not self)
          if (character.creatorId !== authorId) {
            await this.prisma.notification.create({
              data: {
                userId: character.creatorId,
                type: 'CHARACTER_FAN_ART',
                actorId: authorId,
                artworkId: artwork.id,
                characterId: character.id,
              },
            })
          }
        }
      } catch (error) {
        // Log but don't fail the whole operation
        this.logger.warn(`Failed to handle character fan art linking: ${error.message}`)
      }
    }

    // Fetch artwork with tags (pass authorId so author can access their own artwork)
    return this.getArtworkById(artwork.id, authorId)
  }

  /**
   * Get artwork by ID with access control
   * @param artworkId - The artwork ID
   * @param currentUserId - The current user ID (optional, for access control)
   * @param contentFilters - The user's content filter settings (optional)
   */
  async getArtworkById(artworkId: string, currentUserId?: string, contentFilters?: ContentFilters) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: ARTWORK_DETAIL_INCLUDE,
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    // Access control based on visibility
    const isAuthor = currentUserId === artwork.authorId
    if (!isAuthor) {
      if (artwork.visibility === 'PRIVATE') {
        throw new ForbiddenException('This artwork is private')
      }

      if (artwork.visibility === 'FOLLOWERS_ONLY') {
        // Check if current user is following the author
        if (!currentUserId) {
          throw new ForbiddenException('This artwork is for followers only')
        }

        const isFollowing = await this.prisma.follow.findFirst({
          where: {
            followerId: currentUserId,
            followingId: artwork.authorId,
            status: 'ACCEPTED',
          },
        })

        if (!isFollowing) {
          throw new ForbiddenException('This artwork is for followers only')
        }
      }
    }

    // Increment view count
    await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { viewCount: { increment: 1 } },
    })

    // Calculate filter setting based on age rating and content filters
    const rating = String(artwork.ageRating)
    let filterSetting: 'show' | 'blur' | 'hide' = 'show'

    // Apply content filters (or defaults for non-logged users)
    const filters = contentFilters || {
      nsfw: 'blur',
      r18: 'hide',
      r18g: 'hide',
    }

    if (rating === 'NSFW' && filters.nsfw) {
      filterSetting = filters.nsfw
    } else if (rating === 'R18' && filters.r18) {
      filterSetting = filters.r18
    } else if (rating === 'R18G' && filters.r18g) {
      filterSetting = filters.r18g
    }

    const result = {
      ...artwork,
      tags: artwork.tags.map((at) => at.tag),
      filterSetting,
    }

    // Apply signed URLs if enabled
    return this.applySignedUrls(result)
  }

  /**
   * Get artworks list with pagination and filters
   */
  async getArtworks(params: ArtworkQueryParams) {
    const page = params.page || 1
    const limit = Math.min(params.limit || 20, 100)
    const skip = (page - 1) * limit

    const where: Prisma.ArtworkWhereInput = {}

    // Visibility filtering based on authentication status
    // - PUBLIC/UNLISTED: visible to everyone
    // - PRIVATE: visible only to the author
    // - FOLLOWERS_ONLY: visible to author and their followers
    if (params.currentUserId) {
      // Logged in user: can see PUBLIC, UNLISTED, own artworks, and FOLLOWERS_ONLY from followed users
      const followingIds = await this.prisma.follow.findMany({
        where: {
          followerId: params.currentUserId,
          status: 'ACCEPTED',
        },
        select: { followingId: true },
      }).then(follows => follows.map(f => f.followingId))

      const visibilityConditions: Prisma.ArtworkWhereInput[] = [
        { visibility: Visibility.PUBLIC },
        { authorId: params.currentUserId },
      ]

      if (params.authorId) {
        visibilityConditions.push({ visibility: Visibility.UNLISTED })
      }

      // FOLLOWERS_ONLY from followed users
      if (followingIds.length > 0) {
        visibilityConditions.push({
          AND: [
            { visibility: Visibility.FOLLOWERS_ONLY },
            { authorId: { in: followingIds } },
          ],
        })
      }

      where.OR = visibilityConditions
    } else {
      if (params.authorId) {
        where.visibility = { in: [Visibility.PUBLIC, Visibility.UNLISTED] }
      } else {
        where.visibility = Visibility.PUBLIC
      }
    }

    // Apply mute filters if user is logged in
    if (params.currentUserId) {
      const [mutedUserIds, mutedTagIds] = await Promise.all([
        this.mutesService.getMutedUserIds(params.currentUserId),
        this.mutesService.getMutedTagIds(params.currentUserId),
      ])

      // Exclude artworks from muted users
      if (mutedUserIds.length > 0) {
        where.authorId = { notIn: mutedUserIds }
      }

      // Exclude artworks with muted tags
      if (mutedTagIds.length > 0) {
        where.tags = {
          none: {
            tagId: { in: mutedTagIds },
          },
        }
      }
    }

    // Full-text search
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
      ]
    }

    if (params.type) {
      where.type = params.type
    }

    if (params.ageRating) {
      where.ageRating = params.ageRating
    }

    if (params.authorId) {
      where.authorId = params.authorId
    }

    if (params.tags && params.tags.length > 0) {
      // When filtering by specific tags, combine with mute filter using AND
      if (where.tags) {
        where.AND = [
          { tags: where.tags },
          {
            tags: {
              some: {
                tag: {
                  name: { in: params.tags },
                },
              },
            },
          },
        ]
        delete where.tags
      } else {
        where.tags = {
          some: {
            tag: {
              name: { in: params.tags },
            },
          },
        }
      }
    }

    if (params.federation === 'local') {
      where.author = {
        is: {
          domain: '',
        },
      }
    } else if (params.federation === 'remote') {
      where.author = {
        is: {
          domain: { not: '' },
        },
      }
    }

    // Determine sort order
    let orderBy: Prisma.ArtworkOrderByWithRelationInput | Prisma.ArtworkOrderByWithRelationInput[] = { createdAt: 'desc' }
    if (params.sort === 'popular') {
      orderBy = { likeCount: 'desc' }
    } else if (params.sort === 'views') {
      orderBy = { viewCount: 'desc' }
    } else if (params.sort === 'creationDateDesc') {
      // Sort by creation date (newest first), fall back to createdAt for nulls
      orderBy = [
        { creationDate: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ]
    } else if (params.sort === 'creationDateAsc') {
      // Sort by creation date (oldest first), fall back to createdAt for nulls
      orderBy = [
        { creationDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ]
    }

    const [artworks, total] = await Promise.all([
      this.prisma.artwork.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: ARTWORK_LIST_SELECT,
      }),
      this.prisma.artwork.count({ where }),
    ])

    // Transform artworks to include thumbnailUrl and imageCount at top level
    // Apply signed URLs if enabled
    const signingEnabled = this.imageSigningService.isEnabled()
    let transformedArtworks = artworks.map((artwork) => {
      const baseArtwork = {
        ...artwork,
        thumbnailUrl: artwork.images[0]?.thumbnailUrl || artwork.images[0]?.url || '',
        imageCount: artwork._count.images,
      }

      // Apply signed URLs to images array and thumbnailUrl
      if (signingEnabled && artwork.images.length > 0) {
        return {
          ...baseArtwork,
          thumbnailUrl: this.imageSigningService.generateSignedUrlV2(artwork.images[0].id, 'thumbnail').url,
          images: artwork.images.map(img => ({
            ...img,
            url: this.imageSigningService.generateSignedUrlV2(img.id, 'standard').url,
            thumbnailUrl: this.imageSigningService.generateSignedUrlV2(img.id, 'thumbnail').url,
          })),
        }
      }

      return baseArtwork
    })

    // Apply word mute filtering (title, description, tags)
    if (params.currentUserId) {
      const wordMutes = await this.mutesService.getWordMutes(params.currentUserId)
      if (wordMutes.length > 0) {
        transformedArtworks = transformedArtworks.filter((artwork) => {
          // Check title
          if (this.matchesAnyWordMute(artwork.title, wordMutes)) {
            return false
          }
          // Check description (if exists)
          if (artwork.description && this.matchesAnyWordMute(artwork.description, wordMutes)) {
            return false
          }
          return true
        })
      }
    }

    // Apply content filters (hide/blur based on age rating)
    const filters = params.contentFilters
    let filteredArtworks = transformedArtworks.map((artwork) => {
      const rating = String(artwork.ageRating)
      let filterSetting: 'show' | 'blur' | 'hide' = 'show'

      if (rating === 'NSFW' && filters?.nsfw) {
        filterSetting = filters.nsfw
      } else if (rating === 'R18' && filters?.r18) {
        filterSetting = filters.r18
      } else if (rating === 'R18G' && filters?.r18g) {
        filterSetting = filters.r18g
      }

      return {
        ...artwork,
        blurred: filterSetting === 'blur',
        _filterSetting: filterSetting, // Temporary for filtering
      }
    })

    // Remove hidden artworks
    filteredArtworks = filteredArtworks.filter((a) => a._filterSetting !== 'hide')

    // Remove temporary field and return
    const finalArtworks = filteredArtworks.map(({ _filterSetting, ...artwork }) => artwork)

    return {
      artworks: finalArtworks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

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
   * Get artworks by username
   * Supports both local users ("username") and remote users ("username@domain")
   * For remote users, fetches artworks from their ActivityPub outbox if needed
   */
  async getArtworksByUsername(
    handle: string,
    page: number = 1,
    limit: number = 20,
    currentUserId?: string,
    contentFilters?: ContentFilters,
    sort?: 'latest' | 'popular' | 'views' | 'creationDateDesc' | 'creationDateAsc',
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
      throw new NotFoundException(`User @${handle} not found`)
    }

    // For remote users, ensure artworks are fetched from their outbox
    if (domain !== '') {
      this.logger.debug(`Fetching remote artworks for ${username}@${domain}`)
      await this.remoteArtworkService.ensureRemoteArtworksFetched(user)
    }

    return this.getArtworks({ page, limit, authorId: user.id, currentUserId, contentFilters, sort })
  }

  /**
   * Update artwork (without image changes)
   */
  async updateArtwork(
    artworkId: string,
    userId: string,
    updateDto: UpdateArtworkDto,
  ) {
    return this.updateArtworkWithImages(artworkId, userId, updateDto)
  }

  /**
   * Update artwork with image operations support
   */
  async updateArtworkWithImages(
    artworkId: string,
    userId: string,
    updateDto: UpdateArtworkDto,
    newImageFiles?: Express.Multer.File[],
  ) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        images: { orderBy: { order: 'asc' } },
        author: true,
      },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    if (artwork.authorId !== userId) {
      throw new ForbiddenException('You can only update your own artworks')
    }

    // Check tier limit for total image count and storage quota
    const { getMaxImagesPerArtwork, getStorageQuota } = await import('../../common/constants/supporter-tiers')
    const effectiveTier = artwork.author.role === 'ADMIN' ? 'TIER_1' : artwork.author.supporterTier
    const maxImages = getMaxImagesPerArtwork(effectiveTier)
    const storageQuota = getStorageQuota(effectiveTier)

    // Process image operations if provided
    const imageOperations = updateDto.imageOperations || []
    const imagesToDelete: string[] = []
    const imageOrderUpdates: { id: string; order: number }[] = []
    let newImageIndex = 0

    // Categorize operations to calculate final image count
    for (const op of imageOperations) {
      if (op.type === 'delete' && op.id) {
        imagesToDelete.push(op.id)
      } else if (op.type === 'keep' && op.id) {
        imageOrderUpdates.push({ id: op.id, order: op.order })
      }
    }

    // Calculate final image count: existing - deleted + new
    const existingCount = artwork.images.length
    const newCount = newImageFiles?.length || 0
    const finalCount = existingCount - imagesToDelete.length + newCount

    if (finalCount > maxImages) {
      throw new BadRequestException(`Maximum ${maxImages} images allowed per artwork for your tier. Current: ${existingCount}, Deleting: ${imagesToDelete.length}, Adding: ${newCount}, Final: ${finalCount}`)
    }

    // Check storage quota for new images
    if (newImageFiles && newImageFiles.length > 0) {
      const totalUploadSize = newImageFiles.reduce((sum, file) => sum + file.size, 0)
      if (artwork.author.usedStorageBytes + BigInt(totalUploadSize) > storageQuota) {
        throw new ForbiddenException(`Storage quota exceeded. You have used ${Number(artwork.author.usedStorageBytes / BigInt(1024 * 1024))}MB of your ${Number(storageQuota / BigInt(1024 * 1024))}MB quota`)
      }
    }

    // Re-initialize categorization for processing (done above already)
    imagesToDelete.length = 0
    imageOrderUpdates.length = 0
    newImageIndex = 0

    // Categorize operations
    for (const op of imageOperations) {
      if (op.type === 'delete' && op.id) {
        imagesToDelete.push(op.id)
      } else if (op.type === 'keep' && op.id) {
        imageOrderUpdates.push({ id: op.id, order: op.order })
      }
    }

    // Upload new images if provided
    const encryptionEnabled = this.storageService.isEncryptionEnabled()
    const uploadedImages: {
      url: string
      thumbnailUrl: string
      width: number
      height: number
      originalWidth: number
      originalHeight: number
      order: number
      storageKey: string
      originalStorageKey: string | null
      fileSize: number
      originalFileSize: number | null
      mimeType: string
      originalFormat: string
      hasMetadata: boolean
      wasResized: boolean
      encryptionIv: string | null
      originalEncryptionIv: string | null
      thumbnailEncryptionIv: string | null
      isEncrypted: boolean
    }[] = []

    if (newImageFiles && newImageFiles.length > 0) {
      // Find 'add' operations to get the order for new images
      const addOperations = imageOperations.filter((op) => op.type === 'add')

      // Get author info for metadata
      const baseUrl = process.env.BASE_URL || 'http://localhost:11104'

      for (const file of newImageFiles) {
        const order = addOperations[newImageIndex]?.order ?? (artwork.images.length + newImageIndex)

        // Prepare metadata input
        const metadataInput = {
          username: artwork.author.username,
          displayName: artwork.author.displayName || undefined,
          artworkTitle: updateDto.title || artwork.title,
          artworkUrl: `${baseUrl}/artworks/${artwork.id}`,
          license: updateDto.license || artwork.license || artwork.author.defaultLicense || 'All Rights Reserved',
          customLicenseUrl: updateDto.customLicenseUrl || artwork.customLicenseUrl || undefined,
          // Extended creation metadata (use updated values or fall back to existing)
          creationDate: updateDto.creationDate ?? artwork.creationDate ?? undefined,
          toolsUsed: updateDto.toolsUsed ?? (artwork.toolsUsed ? JSON.parse(artwork.toolsUsed) : undefined),
          medium: updateDto.medium ?? artwork.medium ?? undefined,
          projectName: updateDto.projectName ?? artwork.projectName ?? undefined,
          isCommission: updateDto.isCommission ?? artwork.isCommission ?? false,
          clientName: updateDto.clientName ?? artwork.clientName ?? undefined,
        }

        const result = await this.storageService.uploadArtworkImage(file, 'artworks', metadataInput)

        uploadedImages.push({
          // URLs will be set after DB insert when we have image IDs
          url: '', // Placeholder
          thumbnailUrl: '', // Placeholder
          width: result.standard.width,
          height: result.standard.height,
          // Store original dimensions for ActivityPub federation
          originalWidth: result.original?.width || result.standard.width,
          originalHeight: result.original?.height || result.standard.height,
          order,
          storageKey: result.standard.key,
          originalStorageKey: result.original?.key || null,
          fileSize: result.standard.size,
          originalFileSize: result.original?.size || null,
          mimeType: result.standard.contentType,
          originalFormat: result.originalFormat,
          hasMetadata: result.hasMetadata,
          wasResized: result.wasResized,
          encryptionIv: result.standard.encryptionIv || null,
          originalEncryptionIv: result.original?.encryptionIv || null,
          thumbnailEncryptionIv: result.thumbnail.encryptionIv || null,
          isEncrypted: encryptionEnabled,
        })
        newImageIndex++
      }
    }

    // Update artwork in transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      // Delete images marked for deletion
      if (imagesToDelete.length > 0) {
        // Get storage keys before deleting
        const toDeleteImages = await tx.artworkImage.findMany({
          where: { id: { in: imagesToDelete }, artworkId },
        })

        // Delete from database
        await tx.artworkImage.deleteMany({
          where: { id: { in: imagesToDelete }, artworkId },
        })

        // Delete from storage (best effort)
        for (const img of toDeleteImages) {
          try {
            await this.storageService.deleteFile(img.storageKey)
            // Delete thumbnail
            const thumbKey = img.storageKey.replace('/artworks/', '/artworks/thumb/')
            await this.storageService.deleteFile(thumbKey).catch(() => {})
          } catch (error) {
            this.logger.warn(`Failed to delete image from storage: ${error.message}`)
          }
        }
      }

      // Update order for kept images
      for (const update of imageOrderUpdates) {
        await tx.artworkImage.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      }

      // Add new images
      if (uploadedImages.length > 0) {
        // Create images first
        await tx.artworkImage.createMany({
          data: uploadedImages.map((img) => ({
            artworkId,
            ...img,
          })),
        })

        // Get the newly created images to update their URLs
        const newImages = await tx.artworkImage.findMany({
          where: {
            artworkId,
            storageKey: { in: uploadedImages.map((img) => img.storageKey) },
          },
        })

        // Update URLs with actual image IDs
        for (const image of newImages) {
          let url: string
          let thumbnailUrl: string

          if (encryptionEnabled) {
            url = this.storageService.getImageUrl(image.id, false)
            thumbnailUrl = this.storageService.getImageUrl(image.id, true)
          } else {
            url = this.storageService.getDirectImageUrl(image.storageKey)
            const thumbKey = image.storageKey.replace('-original-', '-thumb-')
            thumbnailUrl = this.storageService.getDirectImageUrl(thumbKey)
          }

          await tx.artworkImage.update({
            where: { id: image.id },
            data: { url, thumbnailUrl },
          })
        }
      }

      // Update artwork basic info
      const updatedArtwork = await tx.artwork.update({
        where: { id: artworkId },
        data: {
          title: updateDto.title,
          description: updateDto.description,
          type: updateDto.type,
          ageRating: updateDto.ageRating,
          visibility: updateDto.visibility,
          disableRightClick: updateDto.disableRightClick,
          license: updateDto.license,
          customLicenseUrl: updateDto.customLicenseUrl,
          customLicenseText: updateDto.customLicenseText,
          // Creation metadata (portfolio fields) - use undefined for fields not provided
          ...(updateDto.creationDate !== undefined && {
            creationDate: updateDto.creationDate ? new Date(updateDto.creationDate) : null,
          }),
          ...(updateDto.creationPeriodValue !== undefined && {
            creationPeriodValue: updateDto.creationPeriodValue,
          }),
          ...(updateDto.creationPeriodUnit !== undefined && {
            creationPeriodUnit: updateDto.creationPeriodUnit,
          }),
          ...(updateDto.isCommission !== undefined && {
            isCommission: updateDto.isCommission,
          }),
          ...(updateDto.clientName !== undefined && {
            clientName: updateDto.clientName || null,
          }),
          ...(updateDto.projectName !== undefined && {
            projectName: updateDto.projectName || null,
          }),
          ...(updateDto.medium !== undefined && {
            medium: updateDto.medium,
          }),
          ...(updateDto.externalUrl !== undefined && {
            externalUrl: updateDto.externalUrl || null,
          }),
          ...(updateDto.toolsUsed !== undefined && {
            toolsUsed: updateDto.toolsUsed ? JSON.stringify(updateDto.toolsUsed) : null,
          }),
          // OG card crop coordinates
          ...(updateDto.ogCardCrop !== undefined && {
            ogCardCropX: updateDto.ogCardCrop?.x ?? null,
            ogCardCropY: updateDto.ogCardCrop?.y ?? null,
            ogCardCropWidth: updateDto.ogCardCrop?.width ?? null,
            ogCardCropHeight: updateDto.ogCardCrop?.height ?? null,
          }),
          ...(updateDto.ogCardBlur !== undefined && {
            ogCardBlur: updateDto.ogCardBlur,
          }),
          // Copyright/Rights holder information
          ...(updateDto.copyrightHolder !== undefined && {
            copyrightHolder: updateDto.copyrightHolder || null,
          }),
          ...(updateDto.copyrightType !== undefined && {
            copyrightType: updateDto.copyrightType,
          }),
          ...(updateDto.copyrightNote !== undefined && {
            copyrightNote: updateDto.copyrightNote || null,
          }),
          // Fan art original creator linking
          ...(updateDto.originalCreatorId !== undefined && {
            originalCreatorId: updateDto.originalCreatorId || null,
          }),
          ...(updateDto.originalCreatorAllowDownload !== undefined && {
            originalCreatorAllowDownload: updateDto.originalCreatorAllowDownload,
          }),
        },
      })

      // Handle tags if provided
      if (updateDto.tags) {
        // Remove existing tags
        await tx.artworkTag.deleteMany({
          where: { artworkId },
        })

        // Add new tags
        for (const tagName of updateDto.tags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          })

          await tx.artworkTag.create({
            data: {
              artworkId: updatedArtwork.id,
              tagId: tag.id,
            },
          })
        }
      }

      return updatedArtwork
    })

    // Send Update Activity to followers (async, don't block response)
    // Only for local users and non-PRIVATE artworks (Mastodon-compatible)
    if (artwork.author.domain === '' && artwork.visibility !== 'PRIVATE') {
      const updatedArtworkWithRelations = await this.prisma.artwork.findUnique({
        where: { id: updated.id },
        include: {
          images: { orderBy: { order: 'asc' } },
          tags: { include: { tag: true } },
          author: true,
        },
      })

      if (updatedArtworkWithRelations) {
        this.activityDeliveryService
          .sendUpdateArtwork(artwork.author, updatedArtworkWithRelations)
          .catch((err) => this.logger.error(`Failed to send Update Activity: ${err.message}`))
      }
    }

    // Pass userId to getArtworkById so author can access their own artwork
    // even if visibility is PRIVATE or FOLLOWERS_ONLY
    return this.getArtworkById(updated.id, userId)
  }

  /**
   * Delete artwork
   */
  async deleteArtwork(artworkId: string, userId: string) {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        images: true,
        author: {
          select: {
            id: true,
            username: true,
            privateKey: true,
            domain: true,
          },
        },
      },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    if (artwork.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own artworks')
    }

    // Send Delete activity to federation (before actually deleting)
    // Only for local users' artworks
    if (artwork.author.domain === '') {
      this.activityDeliveryService
        .sendDeleteArtwork(artwork.author, artworkId)
        .catch((err) => this.logger.error(`Failed to send Delete activity: ${err.message}`))
    }

    // Delete images from storage (best effort, don't fail if storage delete fails)
    for (const image of artwork.images) {
      try {
        const urlParts = image.url.split('/')
        const key = urlParts.slice(4).join('/')
        await this.storageService.deleteFile(key)

        if (image.thumbnailUrl) {
          const thumbUrlParts = image.thumbnailUrl.split('/')
          const thumbKey = thumbUrlParts.slice(4).join('/')
          await this.storageService.deleteFile(thumbKey)
        }
      } catch (error) {
        console.error(`Failed to delete image from storage: ${error.message}`)
      }
    }

    // Delete artwork (cascade will delete images, tags, likes, etc.)
    await this.prisma.artwork.delete({
      where: { id: artworkId },
    })

    return { message: 'Artwork deleted successfully' }
  }

  /**
   * Generate OG card for artwork
   */
  async generateOgCard(
    artworkId: string,
    userId: string,
    generateDto: GenerateOgCardDto,
  ): Promise<{ ogCardUrl: string }> {
    // Fetch artwork with images
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        images: true,
      },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }
    if (artwork.authorId !== userId) {
      throw new ForbiddenException('You can only generate OG cards for your own artworks')
    }

    // Find source image
    const sourceImage = artwork.images.find(img => img.id === generateDto.imageId)
    if (!sourceImage) {
      throw new NotFoundException('Source image not found')
    }

    const useOriginal = sourceImage.originalStorageKey !== null
    const storageKey = useOriginal ? sourceImage.originalStorageKey! : sourceImage.storageKey
    const encryptionIv = useOriginal ? sourceImage.originalEncryptionIv : sourceImage.encryptionIv

    // Get image dimensions for crop calculation
    // If using original, use originalWidth/originalHeight; otherwise use standard dimensions
    const imageWidth = useOriginal
      ? (sourceImage.originalWidth ?? sourceImage.width)
      : sourceImage.width
    const imageHeight = useOriginal
      ? (sourceImage.originalHeight ?? sourceImage.height)
      : sourceImage.height

    // Fetch source image buffer from MinIO
    const imageData = await this.storageService.getObject(storageKey)

    // Decrypt if image is encrypted (same pattern as image-proxy.controller.ts)
    let sourceBuffer = imageData
    if (encryptionIv) {
      // Access EncryptionService through StorageService
      const encryptionService = this.storageService['encryptionService']
      if (encryptionService && encryptionService.isEnabled()) {
        sourceBuffer = await encryptionService.decrypt(imageData, encryptionIv)
      }
    }

    // Calculate default center crop if not provided
    // Coordinates are in original image pixels
    let cropRegion = generateDto.cropRegion
    if (!cropRegion) {
      const targetRatio = 16 / 9
      const imageRatio = imageWidth / imageHeight

      if (imageRatio > targetRatio) {
        // Image is wider than 16:9, crop width
        const cropWidth = imageHeight * targetRatio
        cropRegion = {
          x: (imageWidth - cropWidth) / 2,
          y: 0,
          width: cropWidth,
          height: imageHeight,
        }
      } else {
        // Image is taller than 16:9, crop height
        const cropHeight = imageWidth / targetRatio
        cropRegion = {
          x: 0,
          y: (imageHeight - cropHeight) / 2,
          width: imageWidth,
          height: cropHeight,
        }
      }
    }

    // Determine blur requirement (R18/R18G is mandatory)
    const requireBlur = generateDto.blur ??
      (artwork.ageRating === 'R18' || artwork.ageRating === 'R18G')

    // Generate OG card
    const result = await this.storageService.generateOgCard(
      sourceBuffer,
      cropRegion,
      { blur: requireBlur },
      artworkId,
    )

    // Update artwork with OG card URL
    await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { ogCardUrl: result.url },
    })

    this.logger.log(`OG card generated for artwork ${artworkId}`)

    return { ogCardUrl: result.url }
  }

  /**
   * Delete OG card for artwork
   */
  async deleteOgCard(artworkId: string, userId: string): Promise<void> {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }
    if (artwork.authorId !== userId) {
      throw new ForbiddenException('You can only delete OG cards for your own artworks')
    }

    // Delete from MinIO if exists
    if (artwork.ogCardUrl) {
      const key = `og-cards/${artworkId}.jpg`
      try {
        await this.storageService.deleteFile(key)
      } catch (error) {
        this.logger.warn(`Failed to delete OG card from storage: ${error.message}`)
      }
    }

    // Update artwork to remove OG card URL
    await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { ogCardUrl: null },
    })

    this.logger.log(`OG card deleted for artwork ${artworkId}`)
  }

  /**
   * Upload Link Card image for artwork
   * Replaces the old generateOgCard approach with direct image upload
   */
  async uploadLinkCard(
    artworkId: string,
    userId: string,
    file: Express.Multer.File,
    uploadDto: { blur?: boolean },
  ): Promise<{ ogCardUrl: string }> {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }
    if (artwork.authorId !== userId) {
      throw new ForbiddenException('You can only upload Link Cards for your own artworks')
    }

    // Delete old Link Card if exists
    if (artwork.ogCardUrl) {
      const oldKey = `og-cards/${artworkId}.jpg`
      try {
        await this.storageService.deleteFile(oldKey)
      } catch (error) {
        this.logger.warn(`Failed to delete old Link Card: ${error.message}`)
      }
    }

    // Upload new Link Card
    const blur = uploadDto.blur ?? false
    const result = await this.storageService.uploadLinkCard(file, blur, artworkId)

    // Update artwork record
    await this.prisma.artwork.update({
      where: { id: artworkId },
      data: {
        ogCardUrl: result.url,
        ogCardBlur: blur,
      },
    })

    this.logger.log(`Link Card uploaded for artwork ${artworkId}`)

    return { ogCardUrl: result.url }
  }

  /**
   * Get artworks from users that the requester is following
   */
  async getFollowingArtworks(userId: string, page = 1, limit = 20, contentFilters?: ContentFilters) {
    const skip = (page - 1) * limit

    // Get list of users that the requester is following
    const follows = await this.prisma.follow.findMany({
      where: {
        followerId: userId,
        status: 'ACCEPTED',
      },
      select: {
        followingId: true,
      },
    })

    const followingIds = follows.map((f) => f.followingId)

    // Include user's own artworks in the feed
    followingIds.push(userId)

    if (followingIds.length === 0) {
      return {
        artworks: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      }
    }

    // Get muted users and tags
    const [mutedUserIds, mutedTagIds] = await Promise.all([
      this.mutesService.getMutedUserIds(userId),
      this.mutesService.getMutedTagIds(userId),
    ])

    // Filter out muted users from following list (but always keep self)
    const filteredFollowingIds = followingIds.filter(
      (id) => id === userId || !mutedUserIds.includes(id),
    )

    if (filteredFollowingIds.length === 0) {
      return {
        artworks: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      }
    }

    const where: Prisma.ArtworkWhereInput = {
      authorId: { in: filteredFollowingIds },
      OR: [
        { visibility: Visibility.PUBLIC },
        { visibility: Visibility.UNLISTED },
        { visibility: Visibility.FOLLOWERS_ONLY },
        { AND: [{ visibility: Visibility.PRIVATE }, { authorId: userId }] },
      ],
    }

    if (mutedTagIds.length > 0) {
      where.tags = {
        none: {
          tagId: { in: mutedTagIds },
        },
      }
    }

    // Get artworks from followed users and self
    const [artworks, total] = await Promise.all([
      this.prisma.artwork.findMany({
        where,
        select: ARTWORK_LIST_SELECT,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.artwork.count({ where }),
    ])

    // Transform artworks to include thumbnailUrl and imageCount at top level
    // Apply signed URLs if enabled
    const signingEnabled = this.imageSigningService.isEnabled()
    let transformedArtworks = artworks.map((artwork) => {
      const baseArtwork = {
        ...artwork,
        thumbnailUrl: artwork.images[0]?.thumbnailUrl || artwork.images[0]?.url || '',
        imageCount: artwork._count.images,
      }

      // Apply signed URLs to images array and thumbnailUrl
      if (signingEnabled && artwork.images.length > 0) {
        return {
          ...baseArtwork,
          thumbnailUrl: this.imageSigningService.generateSignedUrlV2(artwork.images[0].id, 'thumbnail').url,
          images: artwork.images.map(img => ({
            ...img,
            url: this.imageSigningService.generateSignedUrlV2(img.id, 'standard').url,
            thumbnailUrl: this.imageSigningService.generateSignedUrlV2(img.id, 'thumbnail').url,
          })),
        }
      }

      return baseArtwork
    })

    // Apply content filters (hide/blur based on age rating)
    if (contentFilters) {
      let filteredArtworks = transformedArtworks.map((artwork) => {
        const rating = String(artwork.ageRating)
        let filterSetting: 'show' | 'blur' | 'hide' = 'show'

        if (rating === 'NSFW' && contentFilters.nsfw) {
          filterSetting = contentFilters.nsfw
        } else if (rating === 'R18' && contentFilters.r18) {
          filterSetting = contentFilters.r18
        } else if (rating === 'R18G' && contentFilters.r18g) {
          filterSetting = contentFilters.r18g
        }

        return {
          ...artwork,
          blurred: filterSetting === 'blur',
          _filterSetting: filterSetting,
        }
      })

      // Remove hidden artworks
      filteredArtworks = filteredArtworks.filter((a) => a._filterSetting !== 'hide')

      // Remove temporary field
      transformedArtworks = filteredArtworks.map(({ _filterSetting, ...artwork }) => artwork)
    }

    return {
      artworks: transformedArtworks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Check if text matches any word mute pattern
   */
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

  /**
   * Check if text matches a specific word mute pattern
   */
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

  /**
   * Refresh a remote artwork by fetching the latest data from the origin server
   * This is called when viewing a remote artwork to ensure the displayed data is up-to-date
   *
   * @param id - The local artwork ID
   * @returns The updated artwork data
   */
  async refreshRemoteArtwork(id: string) {
    // Find the artwork with author info
    const artwork = await this.prisma.artwork.findUnique({
      where: { id },
      include: {
        author: true,
        images: {
          orderBy: { order: 'asc' },
        },
        tags: {
          include: { tag: true },
        },
      },
    })

    if (!artwork) {
      throw new NotFoundException('Artwork not found')
    }

    // Check if this is a remote artwork
    if (!artwork.apObjectId || !artwork.author.domain) {
      throw new BadRequestException('Not a remote artwork')
    }

    // Check if the author has an actor URL
    if (!artwork.author.actorUrl) {
      throw new BadRequestException('Remote artwork author has no actor URL')
    }

    try {
      // Get credentials for HTTP signature
      const credentials = await this.actorService.getSystemActorCredentials()

      // Fetch the latest Note from the remote server
      const note = await this.remoteFetchService.fetchObject(artwork.apObjectId, {
        keyId: credentials.keyId,
        privateKey: credentials.privateKey,
      })

      if (!note) {
        this.logger.warn(`Failed to fetch remote artwork: ${artwork.apObjectId}`)
        // Return existing data if remote is unreachable
        return this.getArtworkById(id)
      }

      // Update the local artwork using inbox service's update logic
      await this.inboxService.handleUpdateArtwork(artwork.author.actorUrl, note)

      // Return the refreshed artwork
      return this.getArtworkById(id)
    } catch (error) {
      this.logger.error(`Error refreshing remote artwork ${id}: ${error.message}`)
      // Return existing data on error
      return this.getArtworkById(id)
    }
  }

  /**
   * Check if user can download the artwork
   * Downloads are allowed for:
   * - Artwork author
   * - Original creator (if originalCreatorAllowDownload is true)
   */
  async canDownloadArtwork(artworkId: string, userId: string): Promise<boolean> {
    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
      select: {
        authorId: true,
        originalCreatorId: true,
        originalCreatorAllowDownload: true,
      },
    })

    if (!artwork) {
      return false
    }

    // Author can always download
    if (artwork.authorId === userId) {
      return true
    }

    // Original creator can download if allowed
    if (
      artwork.originalCreatorId === userId &&
      artwork.originalCreatorAllowDownload
    ) {
      return true
    }

    return false
  }

  /**
   * Get download info for an artwork image
   * Returns signed URL for downloading the original image
   */
  async getDownloadInfo(
    artworkId: string,
    imageId: string,
    userId: string,
  ): Promise<{ url: string; filename: string; mimeType: string }> {
    // Check download permission
    const canDownload = await this.canDownloadArtwork(artworkId, userId)
    if (!canDownload) {
      throw new ForbiddenException('You do not have permission to download this artwork')
    }

    // Get the image
    const image = await this.prisma.artworkImage.findFirst({
      where: {
        id: imageId,
        artworkId: artworkId,
      },
      include: {
        artwork: {
          select: {
            title: true,
          },
        },
      },
    })

    if (!image) {
      throw new NotFoundException('Image not found')
    }

    // Generate signed URL for the original image (or standard if no original)
    const variant = image.originalStorageKey ? 'original' : 'standard'
    const signedUrl = this.imageSigningService.generateSignedUrlV2(imageId, variant)

    // Generate filename
    const safeTitle = (image.artwork.title || 'artwork')
      .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '_')
      .substring(0, 50)
    const extension = image.mimeType.split('/')[1] || 'jpg'
    const filename = `${safeTitle}_${imageId}.${extension}`

    return {
      url: signedUrl.url,
      filename,
      mimeType: image.mimeType,
    }
  }

  /**
   * Get all downloadable images for an artwork
   */
  async getArtworkDownloadInfos(
    artworkId: string,
    userId: string,
  ): Promise<Array<{ imageId: string; url: string; filename: string; mimeType: string }>> {
    // Check download permission
    const canDownload = await this.canDownloadArtwork(artworkId, userId)
    if (!canDownload) {
      throw new ForbiddenException('You do not have permission to download this artwork')
    }

    // Get all images for the artwork
    const images = await this.prisma.artworkImage.findMany({
      where: { artworkId },
      orderBy: { order: 'asc' },
      include: {
        artwork: {
          select: {
            title: true,
          },
        },
      },
    })

    if (images.length === 0) {
      throw new NotFoundException('No images found for this artwork')
    }

    return images.map((image, index) => {
      const variant = image.originalStorageKey ? 'original' : 'standard'
      const signedUrl = this.imageSigningService.generateSignedUrlV2(image.id, variant)

      const safeTitle = (image.artwork.title || 'artwork')
        .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '_')
        .substring(0, 50)
      const extension = image.mimeType.split('/')[1] || 'jpg'
      const filename = images.length > 1
        ? `${safeTitle}_${index + 1}.${extension}`
        : `${safeTitle}.${extension}`

      return {
        imageId: image.id,
        url: signedUrl.url,
        filename,
        mimeType: image.mimeType,
      }
    })
  }
}
