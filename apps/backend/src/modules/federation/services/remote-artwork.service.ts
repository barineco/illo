import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../prisma/prisma.service'
import { User } from '@prisma/client'
import { OutboxFetchService } from './outbox-fetch.service'
import { RemoteArtworkData } from '../dto/remote-artwork.dto'
import { REMOTE_IMAGE_CACHE_QUEUE } from '../../queue/queue.module'
import { CacheImageJobData } from '../processors/remote-image-cache.processor'

/**
 * Remote Artwork Service
 *
 * Stores and manages remote artworks fetched via ActivityPub
 */
@Injectable()
export class RemoteArtworkService {
  private readonly logger = new Logger(RemoteArtworkService.name)

  /**
   * Cache TTL in milliseconds (1 hour)
   */
  private readonly CACHE_TTL_MS = 60 * 60 * 1000

  constructor(
    private readonly outboxFetch: OutboxFetchService,
    private readonly prisma: PrismaService,
    @InjectQueue(REMOTE_IMAGE_CACHE_QUEUE) private readonly cacheQueue: Queue<CacheImageJobData>,
  ) {}

  /**
   * Ensure remote artworks are fetched for a user
   * Will skip if cache is still valid
   *
   * @param user - Remote user to fetch artworks for
   */
  async ensureRemoteArtworksFetched(user: User): Promise<void> {
    // Skip if not a remote user
    if (!user.domain || user.domain === '') {
      this.logger.debug(`Skipping local user: ${user.username}`)
      return
    }

    // Check cache validity
    if (this.isCacheValid(user.lastFetchedAt)) {
      this.logger.debug(
        `Cache valid for ${user.username}@${user.domain} (last fetched: ${user.lastFetchedAt})`,
      )
      return
    }

    this.logger.log(`Fetching artworks for ${user.username}@${user.domain}`)

    try {
      // Fetch artworks from outbox
      const result = await this.outboxFetch.fetchUserOutbox(user)

      if (result.artworks.length > 0) {
        // Sync artworks to database
        await this.syncArtworks(user.id, result.artworks)
        this.logger.log(
          `Synced ${result.artworks.length} artworks for ${user.username}@${user.domain}`,
        )
      } else {
        this.logger.debug(`No artworks found for ${user.username}@${user.domain}`)
      }

      // Update last fetched timestamp
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastFetchedAt: new Date() },
      })
    } catch (error) {
      this.logger.error(
        `Failed to fetch artworks for ${user.username}@${user.domain}`,
        error,
      )

      // Increment error count
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          fetchErrorCount: { increment: 1 },
          lastFetchedAt: new Date(), // Still update to prevent immediate retry
        },
      })

      // Don't throw - allow showing stale/no data
    }
  }

  /**
   * Sync remote artworks to the database
   * Uses upsert to handle updates
   *
   * @param userId - Local database user ID
   * @param artworks - Parsed artwork data
   */
  private async syncArtworks(userId: string, artworks: RemoteArtworkData[]): Promise<void> {
    for (const artwork of artworks) {
      try {
        // Check if artwork already exists
        const existing = await this.prisma.artwork.findUnique({
          where: { apObjectId: artwork.apObjectId },
          include: { images: true },
        })

        if (existing) {
          // Update existing artwork (but don't touch images - complex diff logic)
          await this.prisma.artwork.update({
            where: { id: existing.id },
            data: {
              title: artwork.title,
              description: artwork.description,
            },
          })
          this.logger.debug(`Updated existing artwork: ${artwork.apObjectId}`)
        } else {
          // Create new artwork with images
          const createdArtwork = await this.prisma.artwork.create({
            data: {
              title: artwork.title,
              description: artwork.description,
              authorId: userId,
              apObjectId: artwork.apObjectId,
              federated: true,
              publishedAt: artwork.publishedAt,
              createdAt: artwork.publishedAt,
              type: 'ILLUSTRATION',
              ageRating: this.parseAgeRatingFromSensitive(artwork.sensitive || false, artwork.summary),
              visibility: 'PUBLIC',
              images: {
                create: artwork.images.map((img, idx) => ({
                  url: img.url,
                  thumbnailUrl: img.url, // Use same URL for now (remote URLs)
                  width: img.width || 0,
                  height: img.height || 0,
                  order: idx,
                  storageKey: `remote:${this.hashUrl(artwork.apObjectId)}:${idx}`,
                  fileSize: 0,
                  mimeType: img.mediaType || 'image/jpeg',
                  originalFormat: 'jpeg', // Default for remote images
                  hasMetadata: false, // Remote images don't have our metadata
                  wasResized: false, // Unknown for remote images
                  remoteUrl: img.url, // Store remote URL for caching
                })),
              },
            },
            include: { images: true },
          })
          this.logger.debug(`Created new artwork: ${artwork.apObjectId}`)

          // Handle tags if present
          if (artwork.tags && artwork.tags.length > 0) {
            await this.syncArtworkTags(artwork.apObjectId, artwork.tags)
          }

          // Queue image caching jobs if auto-cache is enabled
          await this.queueImageCacheJobs(createdArtwork.images.map((img) => img.id))
        }
      } catch (error) {
        this.logger.error(`Failed to sync artwork: ${artwork.apObjectId}`, error)
        // Continue with other artworks
      }
    }
  }

  /**
   * Sync tags for an artwork
   */
  private async syncArtworkTags(apObjectId: string, tags: string[]): Promise<void> {
    const artwork = await this.prisma.artwork.findUnique({
      where: { apObjectId },
    })

    if (!artwork) return

    for (const tagName of tags) {
      try {
        // Find or create tag
        const tag = await this.prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        })

        // Link tag to artwork (ignore if already linked)
        await this.prisma.artworkTag.upsert({
          where: {
            artworkId_tagId: {
              artworkId: artwork.id,
              tagId: tag.id,
            },
          },
          update: {},
          create: {
            artworkId: artwork.id,
            tagId: tag.id,
          },
        })
      } catch (error) {
        this.logger.warn(`Failed to sync tag "${tagName}" for artwork ${apObjectId}`)
      }
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(lastFetchedAt: Date | null): boolean {
    if (!lastFetchedAt) return false
    return Date.now() - lastFetchedAt.getTime() < this.CACHE_TTL_MS
  }

  /**
   * Generate a short hash for storage key
   */
  private hashUrl(url: string): string {
    // Simple hash function for unique storage key
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Parse age rating from ActivityPub sensitive flag and summary (CW text)
   * Same logic as inbox.service.ts
   */
  private parseAgeRatingFromSensitive(sensitive: boolean, summary?: string): 'ALL_AGES' | 'NSFW' | 'R18' | 'R18G' {
    if (!sensitive) {
      return 'ALL_AGES'
    }

    const lowerSummary = (summary || '').toLowerCase()

    if (lowerSummary.includes('r-18g') || lowerSummary.includes('r18g')) {
      return 'R18G'
    }

    if (lowerSummary.includes('r-18') || lowerSummary.includes('r18')) {
      return 'R18'
    }

    return 'NSFW'
  }

  /**
   * Force refresh artworks for a user (bypass cache)
   */
  async forceRefreshArtworks(user: User): Promise<void> {
    // Clear last fetched timestamp to force refresh
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastFetchedAt: null },
    })

    // Now fetch
    await this.ensureRemoteArtworksFetched(user)
  }

  /**
   * Queue image cache jobs for newly created remote images
   */
  private async queueImageCacheJobs(imageIds: string[]): Promise<void> {
    try {
      // Check if auto-cache is enabled
      const settings = await this.prisma.instanceSettings.findFirst()
      if (!settings?.remoteImageAutoCache || !settings?.remoteImageCacheEnabled) {
        this.logger.debug('Auto-cache disabled, skipping queue')
        return
      }

      for (const imageId of imageIds) {
        await this.cacheQueue.add(
          'cache-artwork-image',
          {
            type: 'artwork_image',
            artworkImageId: imageId,
          },
          {
            delay: 5000, // 5秒遅延（作成直後のラッシュを避ける）
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000, // 1分から開始
            },
          },
        )
      }

      this.logger.debug(`Queued ${imageIds.length} image cache jobs`)
    } catch (error) {
      this.logger.warn(`Failed to queue image cache jobs: ${error.message}`)
    }
  }
}
