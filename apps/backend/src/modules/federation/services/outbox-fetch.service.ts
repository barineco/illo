import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { User } from '@prisma/client'
import { RemoteFetchService, FetchOptions } from './remote-fetch.service'
import { RemoteArtworkData, RemoteImageData, OutboxFetchResult } from '../dto/remote-artwork.dto'

/**
 * Outbox Fetch Service
 *
 * Fetches and parses remote user outboxes via ActivityPub
 */
@Injectable()
export class OutboxFetchService {
  private readonly logger = new Logger(OutboxFetchService.name)

  constructor(
    private readonly remoteFetch: RemoteFetchService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get signing credentials for outbox fetch requests
   * Uses the instance admin user's keys
   */
  private async getSigningCredentials(): Promise<{ keyId: string; privateKey: string } | null> {
    // Get instance settings to find admin user
    const settings = await this.prisma.instanceSettings.findFirst()
    if (!settings?.adminUserId) {
      this.logger.warn('No admin user configured for HTTP signatures')
      return null
    }

    // Get admin user with keys
    const adminUser = await this.prisma.user.findUnique({
      where: { id: settings.adminUserId },
    })

    if (!adminUser?.privateKey || !adminUser?.publicKey) {
      this.logger.warn('Admin user has no keys for HTTP signatures')
      return null
    }

    const publicUrl = settings.publicUrl || this.configService.get<string>('BASE_URL')
    if (!publicUrl) {
      this.logger.warn('No public URL configured')
      return null
    }

    return {
      keyId: `${publicUrl}/users/${adminUser.username}#main-key`,
      privateKey: adminUser.privateKey,
    }
  }

  /**
   * Fetch a remote user's outbox and parse artworks
   *
   * @param user - Remote user with outbox URL
   * @returns Parsed artwork data
   */
  async fetchUserOutbox(user: User): Promise<OutboxFetchResult> {
    if (!user.outbox) {
      this.logger.warn(`User ${user.username}@${user.domain} has no outbox URL`)
      return { artworks: [], totalItems: 0 }
    }

    this.logger.log(`Fetching outbox for ${user.username}@${user.domain}: ${user.outbox}`)

    // Get signing credentials
    const credentials = await this.getSigningCredentials()

    const options: FetchOptions = {
      useSignature: !!credentials,
      keyId: credentials?.keyId,
      privateKey: credentials?.privateKey,
      timeout: 5000, // 5 second timeout
    }

    try {
      // Fetch the outbox OrderedCollection
      const collection = await this.remoteFetch.fetchObject(user.outbox, options)

      if (!collection) {
        this.logger.warn(`Failed to fetch outbox: ${user.outbox}`)
        return { artworks: [], totalItems: 0 }
      }

      this.logger.debug(`Outbox collection type: ${collection.type}`)

      // Handle OrderedCollection with first page reference
      if (collection.type === 'OrderedCollection') {
        const totalItems = collection.totalItems || 0

        // If items are inlined, use them directly
        if (collection.orderedItems && Array.isArray(collection.orderedItems)) {
          const artworks = this.parseActivities(collection.orderedItems)
          return { artworks, totalItems }
        }

        // Otherwise, fetch the first page
        const firstPageUrl = collection.first
        if (firstPageUrl) {
          const pageUrl = typeof firstPageUrl === 'string' ? firstPageUrl : firstPageUrl.id
          return this.fetchOutboxPage(pageUrl, totalItems, options)
        }

        // Try default page URL
        const defaultPageUrl = `${user.outbox}?page=true`
        return this.fetchOutboxPage(defaultPageUrl, totalItems, options)
      }

      // Handle OrderedCollectionPage directly
      if (collection.type === 'OrderedCollectionPage') {
        const artworks = this.parseActivities(collection.orderedItems || [])
        return {
          artworks,
          totalItems: collection.totalItems || artworks.length,
          nextPage: collection.next,
        }
      }

      this.logger.warn(`Unexpected collection type: ${collection.type}`)
      return { artworks: [], totalItems: 0 }
    } catch (error) {
      this.logger.error(`Error fetching outbox for ${user.username}@${user.domain}`, error)
      return { artworks: [], totalItems: 0 }
    }
  }

  /**
   * Fetch a specific page of the outbox collection
   */
  private async fetchOutboxPage(
    pageUrl: string,
    totalItems: number,
    options: FetchOptions,
  ): Promise<OutboxFetchResult> {
    this.logger.debug(`Fetching outbox page: ${pageUrl}`)

    const page = await this.remoteFetch.fetchObject(pageUrl, options)

    if (!page) {
      this.logger.warn(`Failed to fetch outbox page: ${pageUrl}`)
      return { artworks: [], totalItems }
    }

    if (page.type !== 'OrderedCollectionPage') {
      this.logger.warn(`Unexpected page type: ${page.type}`)
      return { artworks: [], totalItems }
    }

    const artworks = this.parseActivities(page.orderedItems || [])
    return {
      artworks,
      totalItems,
      nextPage: page.next,
    }
  }

  /**
   * Parse an array of activities into artwork data
   */
  private parseActivities(activities: any[]): RemoteArtworkData[] {
    const artworks: RemoteArtworkData[] = []

    for (const activity of activities) {
      // Only process Create activities
      if (activity.type !== 'Create') {
        continue
      }

      const artwork = this.parseActivityObject(activity.object, activity.actor)
      if (artwork) {
        artworks.push(artwork)
      }
    }

    this.logger.debug(`Parsed ${artworks.length} artworks from ${activities.length} activities`)
    return artworks
  }

  /**
   * Parse an ActivityPub object (Note/Article/Image) into artwork data
   */
  private parseActivityObject(obj: any, actorUrl: string | any): RemoteArtworkData | null {
    if (!obj || typeof obj !== 'object') {
      return null
    }

    // Support Note, Article, Image types
    const supportedTypes = ['Note', 'Article', 'Image', 'Document']
    if (!supportedTypes.includes(obj.type)) {
      this.logger.debug(`Skipping unsupported object type: ${obj.type}`)
      return null
    }

    // Must have an ID
    if (!obj.id) {
      this.logger.debug('Object missing ID')
      return null
    }

    // Extract images from attachment
    const images = this.extractImages(obj)

    // For illustration platform, we require at least one image
    if (images.length === 0) {
      this.logger.debug(`Skipping object without images: ${obj.id}`)
      return null
    }

    // Extract actor URL
    const authorUrl = typeof actorUrl === 'string' ? actorUrl : actorUrl?.id || obj.attributedTo

    // Extract tags
    const tags = this.extractTags(obj)

    return {
      apObjectId: obj.id,
      title: obj.name || this.truncateContent(obj.content) || 'Untitled',
      description: obj.content ? this.stripHtml(obj.content) : undefined,
      images,
      publishedAt: new Date(obj.published || Date.now()),
      authorActorUrl: authorUrl,
      tags,
      sensitive: obj.sensitive || false,
      summary: obj.summary || undefined, // CW text for age rating detection
    }
  }

  /**
   * Extract images from attachment array
   */
  private extractImages(obj: any): RemoteImageData[] {
    const images: RemoteImageData[] = []
    const attachments = obj.attachment || []

    if (!Array.isArray(attachments)) {
      // Single attachment case
      if (attachments.type === 'Image' || attachments.type === 'Document') {
        images.push(this.parseAttachmentToImage(attachments))
      }
      return images
    }

    for (const attachment of attachments) {
      if (attachment.type === 'Image' || attachment.type === 'Document') {
        const image = this.parseAttachmentToImage(attachment)
        if (image) {
          images.push(image)
        }
      }
    }

    return images
  }

  /**
   * Parse a single attachment to image data
   */
  private parseAttachmentToImage(attachment: any): RemoteImageData | null {
    const url = attachment.url
    if (!url) {
      return null
    }

    // Handle url as string or object
    const imageUrl = typeof url === 'string' ? url : url.href || url.url

    if (!imageUrl) {
      return null
    }

    return {
      url: imageUrl,
      mediaType: attachment.mediaType,
      width: attachment.width,
      height: attachment.height,
    }
  }

  /**
   * Extract hashtags from tag array
   */
  private extractTags(obj: any): string[] {
    const tags: string[] = []
    const tagArray = obj.tag || []

    if (!Array.isArray(tagArray)) {
      return tags
    }

    for (const tag of tagArray) {
      if (tag.type === 'Hashtag' && tag.name) {
        // Remove # prefix if present
        tags.push(tag.name.replace(/^#/, ''))
      }
    }

    return tags
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim()
  }

  /**
   * Truncate content for title (first 100 chars)
   */
  private truncateContent(content: string | undefined): string | undefined {
    if (!content) return undefined
    const stripped = this.stripHtml(content)
    if (stripped.length <= 100) return stripped
    return stripped.substring(0, 97) + '...'
  }
}
