import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ActorService } from './actor.service'
import {
  OrderedCollection,
  OrderedCollectionPage,
  CreateActivity,
  Note,
  AP_CONTEXT,
  AP_PUBLIC,
} from '@illo/shared'

/**
 * Outbox Service
 *
 * Exposes local user artworks via ActivityPub outbox endpoint
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name)

  /**
   * Number of items per page
   */
  private readonly PAGE_SIZE = 20

  constructor(
    private readonly prisma: PrismaService,
    private readonly actorService: ActorService,
  ) {}

  /**
   * Get total count of public artworks for a user
   */
  async getTotalArtworks(username: string): Promise<number> {
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '', // Local users only
      },
    })

    if (!user) {
      throw new NotFoundException(`User not found: ${username}`)
    }

    // ローカル作品は publishedAt が null でも公開されている
    // リモート作品は publishedAt がある
    return this.prisma.artwork.count({
      where: {
        authorId: user.id,
        visibility: 'PUBLIC',
      },
    })
  }

  /**
   * Get outbox OrderedCollection
   */
  async getOutbox(username: string): Promise<OrderedCollection> {
    const publicUrl = await this.actorService.getPublicUrl()
    const outboxUrl = `${publicUrl}/users/${username}/outbox`
    const totalItems = await this.getTotalArtworks(username)

    return {
      '@context': AP_CONTEXT,
      id: outboxUrl,
      type: 'OrderedCollection',
      totalItems,
      first: `${outboxUrl}?page=true`,
    }
  }

  /**
   * Get a page of outbox activities
   */
  async getOutboxPage(
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
    const outboxUrl = `${publicUrl}/users/${username}/outbox`
    const actorUrl = `${publicUrl}/users/${username}`

    // Fetch artworks with images and tags
    // ローカル作品は publishedAt が null でも公開されている
    const skip = (pageNum - 1) * this.PAGE_SIZE
    const artworks = await this.prisma.artwork.findMany({
      where: {
        authorId: user.id,
        visibility: 'PUBLIC',
      },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: this.PAGE_SIZE,
      skip,
    })

    const totalItems = await this.prisma.artwork.count({
      where: {
        authorId: user.id,
        visibility: 'PUBLIC',
      },
    })

    // Convert artworks to Create activities
    const activities = artworks.map((artwork) =>
      this.artworkToCreateActivity(artwork, actorUrl, publicUrl),
    )

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / this.PAGE_SIZE)
    const hasNext = pageNum < totalPages
    const hasPrev = pageNum > 1

    const page: OrderedCollectionPage = {
      '@context': AP_CONTEXT,
      id: `${outboxUrl}?page=${pageNum}`,
      type: 'OrderedCollectionPage',
      totalItems,
      orderedItems: activities,
      partOf: outboxUrl,
    }

    if (hasNext) {
      page.next = `${outboxUrl}?page=${pageNum + 1}`
    }

    if (hasPrev) {
      page.prev = `${outboxUrl}?page=${pageNum - 1}`
    }

    return page
  }

  /**
   * Convert an artwork to ActivityPub Note object
   * This is a public method so other services can reuse it
   *
   * Visibility handling (Mastodon-compatible):
   * - PUBLIC: to=[AP_PUBLIC], cc=[followers]
   * - UNLISTED: to=[followers], cc=[AP_PUBLIC]
   * - FOLLOWERS_ONLY: to=[followers], cc=[]
   * - PRIVATE: Not delivered via ActivityPub
   */
  artworkToNote(artwork: any, actorUrl: string, publicUrl: string): Note {
    const objectUrl = artwork.apObjectId || `${publicUrl}/artworks/${artwork.id}`
    const followersUrl = `${actorUrl}/followers`

    // Determine to/cc based on visibility (Mastodon-compatible)
    let to: string[]
    let cc: string[]

    switch (artwork.visibility) {
      case 'UNLISTED':
        // Unlisted: delivered to followers, but AP_PUBLIC in cc (not in public timelines)
        to = [followersUrl]
        cc = [AP_PUBLIC]
        break
      case 'FOLLOWERS_ONLY':
        // Followers only: only delivered to followers
        to = [followersUrl]
        cc = []
        break
      case 'PUBLIC':
      default:
        // Public: delivered to everyone
        to = [AP_PUBLIC]
        cc = [followersUrl]
        break
    }

    // Build base Note object
    const note: Note & Record<string, any> = {
      id: objectUrl,
      type: 'Note',
      content: this.buildContent(artwork),
      published: artwork.publishedAt?.toISOString() || artwork.createdAt.toISOString(),
      attributedTo: actorUrl,
      to,
      cc,
      sensitive: artwork.ageRating !== 'ALL_AGES', // NSFW, R18, R18G are all sensitive
      summary: this.getContentWarningSummary(artwork.ageRating),
      attachment: artwork.images.map((img: any) => ({
        type: 'Image' as const,
        mediaType: 'image/jpeg', // Federation endpoint always serves JPEG thumbnails
        // Use federation endpoint for local images
        // This returns THUMBNAIL (320px) only - high-res requires HTTP signature auth
        url: img.storageKey?.startsWith('remote:') ? img.url : `${publicUrl}/api/federation/images/${img.id}`,
        name: artwork.title,
        // width/height intentionally omitted to prevent external crawlers from knowing full resolution
      })),
      tag:
        artwork.tags?.map((at: any) => ({
          type: 'Hashtag' as const,
          name: `#${at.tag.name}`,
          href: `${publicUrl}/tags/${encodeURIComponent(at.tag.name)}`,
        })) || [],
    }

    // Add open-illustboard extension properties
    // These are namespaced to avoid conflicts with other ActivityPub implementations
    // Non-illustboard servers will simply ignore these properties
    note['illustboard:disableRightClick'] = artwork.disableRightClick ?? true
    if (artwork.customLicenseUrl) {
      note['illustboard:customLicenseUrl'] = artwork.customLicenseUrl
    }
    if (artwork.customLicenseText) {
      note['illustboard:customLicenseText'] = artwork.customLicenseText
    }
    if (artwork.license) {
      note['illustboard:license'] = artwork.license
    }

    return note
  }

  /**
   * Convert an artwork to ActivityPub Create activity
   */
  private artworkToCreateActivity(
    artwork: any,
    actorUrl: string,
    publicUrl: string,
  ): CreateActivity {
    const note = this.artworkToNote(artwork, actorUrl, publicUrl)

    // Use existing apObjectId or generate one
    const activityId = artwork.apObjectId || `${publicUrl}/artworks/${artwork.id}#activity`

    return {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Create',
      actor: actorUrl,
      published: note.published,
      to: [AP_PUBLIC],
      cc: [`${actorUrl}/followers`],
      object: note,
    }
  }

  /**
   * Build HTML content for the artwork
   */
  private buildContent(artwork: any): string {
    let content = `<p><strong>${this.escapeHtml(artwork.title)}</strong></p>`

    if (artwork.description) {
      content += `<p>${this.escapeHtml(artwork.description)}</p>`
    }

    return content
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  /**
   * Get Content Warning summary text based on age rating
   * Mastodon uses the `summary` field as CW text
   *
   * @param ageRating - The artwork's age rating
   * @returns CW summary text or undefined for ALL_AGES
   */
  private getContentWarningSummary(ageRating: string): string | undefined {
    switch (ageRating) {
      case 'NSFW':
        return 'NSFW'
      case 'R18':
        return 'R-18'
      case 'R18G':
        return 'R-18G'
      default:
        return undefined
    }
  }
}
