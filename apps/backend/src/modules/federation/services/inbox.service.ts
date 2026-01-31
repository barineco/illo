import { Injectable, Logger, BadRequestException, forwardRef, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { RemoteFetchService } from './remote-fetch.service'
import { HttpSignatureService } from './http-signature.service'
import { FederationSearchService } from './federation-search.service'
import { ActivityDeliveryService } from './activity-delivery.service'
import { MessagesService } from '../../messages/messages.service'
import { Request } from 'express'
import { User, RemoteImageCacheStatus } from '@prisma/client'
import * as crypto from 'crypto'

// ActivityPub Public addressing
const AP_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'

/**
 * ActivityPub Activity types we handle
 */
type ActivityType = 'Follow' | 'Undo' | 'Like' | 'Announce' | 'Create' | 'Delete' | 'Accept' | 'Reject' | 'Update'

/**
 * Inbox Service
 *
 * Handles incoming ActivityPub activities:
 * - Follow: Add follower relationship
 * - Undo Follow: Remove follower relationship
 * - Like: Add like to artwork
 * - Undo Like: Remove like from artwork
 */
@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly remoteFetch: RemoteFetchService,
    private readonly httpSignature: HttpSignatureService,
    private readonly federationSearch: FederationSearchService,
    @Inject(forwardRef(() => ActivityDeliveryService))
    private readonly activityDelivery: ActivityDeliveryService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Ensure a remote actor exists in our database
   * Fetches from actor URL and creates/updates user record
   */
  private async ensureRemoteActor(actorUrl: string): Promise<User | null> {
    try {
      const existingUser = await this.prisma.user.findFirst({
        where: { actorUrl },
      })

      if (existingUser) {
        return existingUser
      }

      const actor = await this.remoteFetch.fetchObject(actorUrl, { timeout: 5000 })
      if (!actor) {
        this.logger.warn(`Could not fetch actor: ${actorUrl}`)
        return null
      }

      const username = actor.preferredUsername || actor.name || 'unknown'
      const domain = new URL(actorUrl).hostname

      let publicKey = ''
      if (actor.publicKey) {
        if (typeof actor.publicKey === 'object' && actor.publicKey.publicKeyPem) {
          publicKey = actor.publicKey.publicKeyPem
        } else if (typeof actor.publicKey === 'string') {
          publicKey = actor.publicKey
        }
      }

      let avatarUrl: string | undefined
      if (actor.icon) {
        if (typeof actor.icon === 'object' && actor.icon.url) {
          avatarUrl = actor.icon.url
        } else if (typeof actor.icon === 'string') {
          avatarUrl = actor.icon
        }
      }

      const user = await this.prisma.user.upsert({
        where: {
          username_domain: {
            username,
            domain,
          },
        },
        update: {
          displayName: actor.name || username,
          avatarUrl,
          bio: actor.summary,
          summary: actor.summary,
          actorUrl: actor.id,
          inbox: actor.inbox,
          outbox: actor.outbox,
          publicKey,
          followersUrl: actor.followers,
          followingUrl: actor.following,
          fetchErrorCount: 0,
        },
        create: {
          username,
          domain,
          displayName: actor.name || username,
          avatarUrl,
          bio: actor.summary,
          summary: actor.summary,
          actorUrl: actor.id,
          inbox: actor.inbox,
          outbox: actor.outbox,
          publicKey,
          followersUrl: actor.followers,
          followingUrl: actor.following,
          email: `${username}@${domain}`,
          passwordHash: '',
          isActive: true,
          isVerified: true,
        },
      })

      return user
    } catch (error) {
      this.logger.error(`Failed to ensure remote actor: ${actorUrl}`, error)
      return null
    }
  }

  /**
   * Verify HTTP signature on incoming request
   */
  async verifyRequest(req: Request, body: any): Promise<boolean> {
    const signature = req.headers['signature'] as string
    if (!signature) {
      this.logger.warn('Missing signature header')
      return false
    }

    const keyIdMatch = signature.match(/keyId="([^"]+)"/)
    if (!keyIdMatch) {
      this.logger.warn('Missing keyId in signature')
      return false
    }
    const keyId = keyIdMatch[1]

    const actorUrl = keyId.replace(/#.*$/, '')
    const actor = await this.remoteFetch.fetchObject(actorUrl, { timeout: 5000 })

    if (!actor?.publicKey?.publicKeyPem) {
      this.logger.warn(`Could not fetch public key for ${actorUrl}`)
      return false
    }

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value
      }
    }

    const isValid = await this.httpSignature.verifySignature({
      signature,
      headers,
      publicKeyPem: actor.publicKey.publicKeyPem,
      method: req.method,
      path: req.originalUrl || req.url,
    })

    if (!isValid) {
      this.logger.warn(`Invalid signature from ${actorUrl}`)
    }

    return isValid
  }

  /**
   * Process incoming activity
   */
  async processActivity(username: string, activity: any): Promise<void> {
    const type = activity.type as ActivityType

    this.logger.log(`Processing ${type} activity for ${username}`)
    this.logger.debug(`Activity: ${JSON.stringify(activity)}`)

    switch (type) {
      case 'Follow':
        await this.handleFollow(username, activity)
        break
      case 'Undo':
        await this.handleUndo(username, activity)
        break
      case 'Like':
        await this.handleLike(activity)
        break
      case 'Accept':
        await this.handleAccept(activity)
        break
      case 'Reject':
        await this.handleReject(activity)
        break
      case 'Create':
        await this.handleCreate(activity)
        break
      case 'Update':
        await this.handleUpdate(activity)
        break
      case 'Announce':
        this.logger.debug(`Received ${type} activity, not implemented yet`)
        break
      case 'Delete':
        await this.handleDelete(activity)
        break
      default:
        this.logger.debug(`Unknown activity type: ${type}`)
    }
  }

  /**
   * Handle Follow activity
   * Remote user wants to follow local user
   */
  private async handleFollow(localUsername: string, activity: any): Promise<void> {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    if (!actorUrl) {
      throw new BadRequestException('Missing actor in Follow activity')
    }

    const localUser = await this.prisma.user.findFirst({
      where: { username: localUsername, domain: '' },
    })

    if (!localUser) {
      this.logger.warn(`Local user not found: ${localUsername}`)
      return
    }

    const remoteUser = await this.ensureRemoteActor(actorUrl)
    if (!remoteUser) {
      this.logger.warn(`Could not resolve remote actor: ${actorUrl}`)
      return
    }

    const existingFollow = await this.prisma.follow.findFirst({
      where: {
        followerId: remoteUser.id,
        followingId: localUser.id,
      },
    })

    if (existingFollow) {
      this.logger.debug(`${remoteUser.username}@${remoteUser.domain} already follows ${localUsername}`)
      return
    }

    const follow = await this.prisma.follow.create({
      data: {
        followerId: remoteUser.id,
        followingId: localUser.id,
      },
    })

    this.logger.log(`${remoteUser.username}@${remoteUser.domain} now follows ${localUsername}`)

    // Emit notification event for local user
    this.eventEmitter.emit('user.followed', {
      actorId: remoteUser.id,
      followedUserId: localUser.id,
      follow: { id: follow.id },
    })

    try {
      await this.activityDelivery.sendAcceptFollow(localUser, activity)
      this.logger.log(`Sent Accept activity to ${remoteUser.username}@${remoteUser.domain}`)
    } catch (error) {
      this.logger.error(`Failed to send Accept activity: ${error}`)
    }
  }

  /**
   * Handle Undo activity
   */
  private async handleUndo(localUsername: string, activity: any): Promise<void> {
    const innerActivity = activity.object
    if (!innerActivity) {
      this.logger.warn('Undo activity missing object')
      return
    }

    const innerType = innerActivity.type
    switch (innerType) {
      case 'Follow':
        await this.handleUndoFollow(localUsername, activity)
        break
      case 'Like':
        await this.handleUndoLike(activity)
        break
      default:
        this.logger.debug(`Unhandled Undo type: ${innerType}`)
    }
  }

  /**
   * Handle Undo Follow activity
   * Remote user wants to unfollow local user
   */
  private async handleUndoFollow(localUsername: string, activity: any): Promise<void> {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    if (!actorUrl) {
      throw new BadRequestException('Missing actor in Undo Follow activity')
    }

    const localUser = await this.prisma.user.findFirst({
      where: { username: localUsername, domain: '' },
    })

    if (!localUser) {
      this.logger.warn(`Local user not found: ${localUsername}`)
      return
    }

    const remoteUser = await this.prisma.user.findFirst({
      where: { actorUrl },
    })

    if (!remoteUser) {
      this.logger.debug(`Remote user not found for unfollow: ${actorUrl}`)
      return
    }

    await this.prisma.follow.deleteMany({
      where: {
        followerId: remoteUser.id,
        followingId: localUser.id,
      },
    })

    this.logger.log(`${remoteUser.username}@${remoteUser.domain} unfollowed ${localUsername}`)
  }

  /**
   * Handle Like activity
   * Remote user likes a local artwork
   */
  private async handleLike(activity: any): Promise<void> {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    const objectUrl = typeof activity.object === 'string' ? activity.object : activity.object?.id

    if (!actorUrl || !objectUrl) {
      this.logger.warn('Like activity missing actor or object')
      return
    }

    const artworkIdMatch = objectUrl.match(/\/artworks\/([^\/]+)$/)
    if (!artworkIdMatch) {
      this.logger.debug(`Like target is not a local artwork: ${objectUrl}`)
      return
    }

    const artworkId = artworkIdMatch[1]

    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
    })

    if (!artwork) {
      this.logger.warn(`Artwork not found for Like: ${artworkId}`)
      return
    }

    const remoteUser = await this.ensureRemoteActor(actorUrl)
    if (!remoteUser) {
      this.logger.warn(`Could not resolve remote actor for Like: ${actorUrl}`)
      return
    }

    const existingLike = await this.prisma.like.findFirst({
      where: {
        userId: remoteUser.id,
        artworkId: artwork.id,
      },
    })

    if (existingLike) {
      this.logger.debug(`${remoteUser.username}@${remoteUser.domain} already liked ${artworkId}`)
      return
    }

    const like = await this.prisma.like.create({
      data: {
        userId: remoteUser.id,
        artworkId: artwork.id,
      },
    })

    this.logger.log(`${remoteUser.username}@${remoteUser.domain} liked artwork ${artworkId}`)

    if (artwork.authorId) {
      const author = await this.prisma.user.findUnique({
        where: { id: artwork.authorId },
        select: { domain: true },
      })

      if (author?.domain === '') {
        this.eventEmitter.emit('artwork.liked', {
          actorId: remoteUser.id,
          artwork: { id: artwork.id, authorId: artwork.authorId },
          like: { id: like.id },
        })
      }
    }
  }

  /**
   * Handle Undo Like activity
   */
  private async handleUndoLike(activity: any): Promise<void> {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    const innerActivity = activity.object
    const objectUrl = typeof innerActivity?.object === 'string' ? innerActivity.object : innerActivity?.object?.id

    if (!actorUrl || !objectUrl) {
      this.logger.warn('Undo Like activity missing actor or object')
      return
    }

    const artworkIdMatch = objectUrl.match(/\/artworks\/([^\/]+)$/)
    if (!artworkIdMatch) {
      this.logger.debug(`Undo Like target is not a local artwork: ${objectUrl}`)
      return
    }

    const artworkId = artworkIdMatch[1]

    const remoteUser = await this.prisma.user.findFirst({
      where: { actorUrl },
    })

    if (!remoteUser) {
      this.logger.debug(`Remote user not found for Undo Like: ${actorUrl}`)
      return
    }

    await this.prisma.like.deleteMany({
      where: {
        userId: remoteUser.id,
        artworkId: artworkId,
      },
    })

    this.logger.log(`${remoteUser.username}@${remoteUser.domain} unliked artwork ${artworkId}`)
  }

  /**
   * Handle Accept activity (response to our Follow request)
   */
  private async handleAccept(activity: any): Promise<void> {
    const innerActivity = activity.object
    if (innerActivity?.type !== 'Follow') {
      this.logger.debug('Accept activity for non-Follow, ignoring')
      return
    }

    this.logger.debug('Follow request accepted')
  }

  /**
   * Handle Reject activity (response to our Follow request)
   */
  private async handleReject(activity: any): Promise<void> {
    const innerActivity = activity.object
    if (innerActivity?.type !== 'Follow') {
      this.logger.debug('Reject activity for non-Follow, ignoring')
      return
    }

    const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    const followActorUrl = typeof innerActivity.actor === 'string' ? innerActivity.actor : innerActivity.actor?.id

    if (!actorUrl || !followActorUrl) {
      return
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { actorUrl },
    })
    const followerUser = await this.prisma.user.findFirst({
      where: { actorUrl: followActorUrl },
    })

    if (targetUser && followerUser) {
      await this.prisma.follow.deleteMany({
        where: {
          followerId: followerUser.id,
          followingId: targetUser.id,
        },
      })
      this.logger.log(`Follow request to ${targetUser.username}@${targetUser.domain} was rejected`)
    }
  }

  /**
   * Handle Create activity
   * Handles incoming Create activities (e.g., Note for comments, PrivateMessage for E2E DMs)
   */
  private async handleCreate(activity: any): Promise<void> {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    const object = activity.object

    if (!actorUrl || !object) {
      this.logger.warn('Create activity missing actor or object')
      return
    }

    // Check for MLS over ActivityPub PrivateMessage
    const objectType = object.type
    const isPrivateMessage = Array.isArray(objectType)
      ? objectType.includes('PrivateMessage')
      : objectType === 'PrivateMessage'

    if (isPrivateMessage) {
      await this.handleEncryptedDirectMessage(actorUrl, object, activity)
      return
    }

    // Standard Note handling
    switch (objectType) {
      case 'Note':
        await this.handleCreateNote(actorUrl, object)
        break
      default:
        this.logger.debug(`Unhandled Create object type: ${objectType}`)
    }
  }

  /**
   * Handle Create Note activity (incoming federated comment or DM)
   */
  private async handleCreateNote(actorUrl: string, note: any): Promise<void> {
    const noteId = typeof note.id === 'string' ? note.id : note.id?.id
    const content = note.content

    if (!noteId || !content) {
      this.logger.warn('Note missing required fields (id, content)')
      return
    }

    // Check if this is a DM (no public addressing)
    const toField = Array.isArray(note.to) ? note.to : [note.to].filter(Boolean)
    const ccField = Array.isArray(note.cc) ? note.cc : [note.cc].filter(Boolean)

    const isPublic = [...toField, ...ccField].some((addr) =>
      addr === AP_PUBLIC || addr === 'as:Public' || addr === 'Public',
    )

    if (!isPublic) {
      await this.handleDirectMessage(actorUrl, note, toField, ccField)
      return
    }

    const inReplyTo = note.inReplyTo
    if (!inReplyTo) {
      const attachments = note.attachment || []
      const hasImageAttachments = attachments.some(
        (att: any) => att.type === 'Image' || att.mediaType?.startsWith('image/'),
      )

      if (hasImageAttachments) {
        await this.handleCreateArtwork(actorUrl, note)
        return
      }

      this.logger.debug('Public Note without inReplyTo and no images, ignoring')
      return
    }

    const artworkIdMatch = inReplyTo.match(/\/artworks\/([^\/]+)$/)
    if (!artworkIdMatch) {
      this.logger.debug(`Note inReplyTo is not a local artwork: ${inReplyTo}`)
      return
    }

    const artworkId = artworkIdMatch[1]

    const artwork = await this.prisma.artwork.findUnique({
      where: { id: artworkId },
    })

    if (!artwork) {
      this.logger.warn(`Artwork not found for comment: ${artworkId}`)
      return
    }

    const existingComment = await this.prisma.comment.findFirst({
      where: { apActivityId: noteId },
    })

    if (existingComment) {
      this.logger.debug(`Comment already exists for Note: ${noteId}`)
      return
    }

    const remoteUser = await this.ensureRemoteActor(actorUrl)
    if (!remoteUser) {
      this.logger.warn(`Could not resolve remote actor for comment: ${actorUrl}`)
      return
    }

    const comment = await this.prisma.comment.create({
      data: {
        userId: remoteUser.id,
        artworkId: artwork.id,
        content: content,
        apActivityId: noteId,
        federated: true,
      },
    })

    await this.prisma.artwork.update({
      where: { id: artwork.id },
      data: {
        commentCount: {
          increment: 1,
        },
      },
    })

    this.logger.log(`Created federated comment from ${remoteUser.username}@${remoteUser.domain} on artwork ${artworkId}`)

    // Emit notification event for local artwork authors
    const author = await this.prisma.user.findUnique({
      where: { id: artwork.authorId },
      select: { domain: true },
    })

    if (author?.domain === '') {
      this.eventEmitter.emit('artwork.commented', {
        actorId: remoteUser.id,
        artwork: { id: artwork.id, authorId: artwork.authorId },
        comment: { id: comment.id },
      })
    }
  }

  /**
   * Handle Update activity
   * Handles updates to remote artworks
   */
  private async handleUpdate(activity: any): Promise<void> {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    const object = activity.object

    if (!actorUrl || !object) {
      this.logger.warn('Update activity missing actor or object')
      return
    }

    const objectType = typeof object === 'string' ? null : object.type
    switch (objectType) {
      case 'Note':
      case 'Article':
      case 'Image':
        await this.handleUpdateArtwork(actorUrl, object)
        break
      case 'Person':
        await this.handleUpdatePerson(actorUrl, object)
        break
      default:
        this.logger.debug(`Unhandled Update object type: ${objectType}`)
    }
  }

  /**
   * Handle Update activity for artwork (Note/Article/Image)
   * Updates an existing remote artwork in our database
   * This method is public so it can be called from artworks.service for refresh functionality
   */
  async handleUpdateArtwork(actorUrl: string, noteObject: any): Promise<void> {
    const objectId = noteObject.id
    if (!objectId) {
      this.logger.warn('Update Note missing id')
      return
    }

    const existingArtwork = await this.prisma.artwork.findUnique({
      where: { apObjectId: objectId },
      include: {
        author: true,
        images: true,
      },
    })

    if (!existingArtwork) {
      this.logger.debug(`Artwork not found for Update: ${objectId}`)
      return
    }

    if (existingArtwork.author.actorUrl !== actorUrl) {
      this.logger.warn(`Update actor mismatch: ${actorUrl} != ${existingArtwork.author.actorUrl}`)
      return
    }

    const title = noteObject.name || this.extractTitleFromContent(noteObject.content) || existingArtwork.title
    const description = noteObject.content ? this.stripHtml(noteObject.content) : existingArtwork.description
    const sensitive = noteObject.sensitive === true
    const summary = noteObject.summary as string | undefined

    const ageRating = this.parseAgeRatingFromSensitive(sensitive, summary)

    const disableRightClick = noteObject['illustboard:disableRightClick']
    const customLicenseUrl = noteObject['illustboard:customLicenseUrl']
    const customLicenseText = noteObject['illustboard:customLicenseText']
    const license = noteObject['illustboard:license']

    const newImages = this.extractImagesFromAttachment(noteObject.attachment || [])

    await this.prisma.$transaction(async (tx) => {
      await tx.artwork.update({
        where: { id: existingArtwork.id },
        data: {
          title,
          description,
          ageRating,
          updatedAt: new Date(),
          disableRightClick: disableRightClick !== undefined ? disableRightClick : existingArtwork.disableRightClick,
          customLicenseUrl: customLicenseUrl !== undefined ? customLicenseUrl : existingArtwork.customLicenseUrl,
          customLicenseText: customLicenseText !== undefined ? customLicenseText : existingArtwork.customLicenseText,
          license: license !== undefined ? license : existingArtwork.license,
        },
      })

      if (newImages.length > 0) {
        const existingImagesByUrl = new Map(
          existingArtwork.images.map(img => [img.remoteUrl || img.url, img])
        )

        const processedUrls = new Set<string>()

        for (const [idx, newImg] of newImages.entries()) {
          const existingImg = existingImagesByUrl.get(newImg.url)

          if (existingImg) {
            // URL unchanged - update order only, preserve cache
            await tx.artworkImage.update({
              where: { id: existingImg.id },
              data: {
                order: idx,
                // Update dimensions if provided and different
                originalWidth: newImg.width || existingImg.originalWidth,
                originalHeight: newImg.height || existingImg.originalHeight,
              },
            })
            processedUrls.add(newImg.url)
          } else {
            // New image - create new record
            await tx.artworkImage.create({
              data: {
                artworkId: existingArtwork.id,
                url: newImg.url,
                thumbnailUrl: newImg.url,
                remoteUrl: newImg.url,
                width: 0,
                height: 0,
                originalWidth: newImg.width || null,
                originalHeight: newImg.height || null,
                order: idx,
                storageKey: `remote:${this.hashUrl(objectId)}:${idx}`,
                fileSize: 0,
                mimeType: newImg.mediaType || 'image/jpeg',
                originalFormat: 'jpeg',
                hasMetadata: false,
                wasResized: false,
                cacheStatus: RemoteImageCacheStatus.NOT_CACHED,
              },
            })
          }
        }

        for (const [url, existingImg] of existingImagesByUrl) {
          if (!processedUrls.has(url)) {
            await tx.artworkImage.delete({
              where: { id: existingImg.id },
            })
          }
        }
      }

      if (noteObject.tag && Array.isArray(noteObject.tag)) {
        await tx.artworkTag.deleteMany({
          where: { artworkId: existingArtwork.id },
        })

        const hashtags = noteObject.tag
          .filter((t: any) => t.type === 'Hashtag' && t.name)
          .map((t: any) => t.name.replace(/^#/, ''))

        for (const tagName of hashtags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            update: {},
            create: { name: tagName },
          })

          await tx.artworkTag.create({
            data: {
              artworkId: existingArtwork.id,
              tagId: tag.id,
            },
          })
        }
      }
    })

    this.logger.log(`Updated remote artwork: ${existingArtwork.id} (${objectId})`)
  }

  /**
   * Handle Update activity for Person (Actor)
   * Updates an existing remote user's profile in our database
   */
  private async handleUpdatePerson(actorUrl: string, personObject: any): Promise<void> {
    const objectId = personObject.id
    if (!objectId) {
      this.logger.warn('Update Person missing id')
      return
    }

    // Verify the actor matches the object being updated (actors can only update themselves)
    if (actorUrl !== objectId) {
      this.logger.warn(`Update Person actor mismatch: actor ${actorUrl} tried to update ${objectId}`)
      return
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { actorUrl: objectId },
    })

    if (!existingUser) {
      this.logger.debug(`Remote user not found for Update Person: ${objectId}`)
      return
    }

    if (existingUser.domain === '') {
      this.logger.warn(`Attempted to update local user via federation: ${existingUser.username}`)
      return
    }

    let avatarUrl: string | undefined
    if (personObject.icon) {
      if (typeof personObject.icon === 'object' && personObject.icon.url) {
        avatarUrl = personObject.icon.url
      } else if (typeof personObject.icon === 'string') {
        avatarUrl = personObject.icon
      }
    }

    let coverImageUrl: string | undefined
    if (personObject.image) {
      if (typeof personObject.image === 'object' && personObject.image.url) {
        coverImageUrl = personObject.image.url
      } else if (typeof personObject.image === 'string') {
        coverImageUrl = personObject.image
      }
    }

    let publicKey: string | undefined
    if (personObject.publicKey) {
      if (typeof personObject.publicKey === 'object' && personObject.publicKey.publicKeyPem) {
        publicKey = personObject.publicKey.publicKeyPem
      } else if (typeof personObject.publicKey === 'string') {
        publicKey = personObject.publicKey
      }
    }

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        displayName: personObject.name || personObject.preferredUsername || existingUser.displayName,
        bio: personObject.summary ?? existingUser.bio,
        summary: personObject.summary ?? existingUser.summary,
        avatarUrl: avatarUrl ?? existingUser.avatarUrl,
        coverImageUrl: coverImageUrl ?? existingUser.coverImageUrl,
        publicKey: publicKey ?? existingUser.publicKey,
        inbox: personObject.inbox ?? existingUser.inbox,
        outbox: personObject.outbox ?? existingUser.outbox,
        followersUrl: personObject.followers ?? existingUser.followersUrl,
        followingUrl: personObject.following ?? existingUser.followingUrl,
        updatedAt: new Date(),
      },
    })

    this.logger.log(`Updated remote user profile: ${existingUser.username}@${existingUser.domain}`)
  }

  /**
   * Extract title from HTML content
   */
  private extractTitleFromContent(content: string | undefined): string | null {
    if (!content) return null
    // Try to extract title from <strong> or first line
    const strongMatch = content.match(/<strong>([^<]+)<\/strong>/)
    if (strongMatch) return strongMatch[1]
    // Strip HTML and take first 100 chars
    const text = this.stripHtml(content)
    if (text.length > 100) return text.substring(0, 100) + '...'
    return text || null
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim()
  }

  /**
   * Extract images from ActivityPub attachment array
   */
  private extractImagesFromAttachment(
    attachment: any[],
  ): { url: string; mediaType?: string; width?: number; height?: number }[] {
    if (!Array.isArray(attachment)) return []

    return attachment
      .filter((a) => a.type === 'Image' || a.type === 'Document')
      .filter((a) => a.url)
      .map((a) => ({
        url: a.url,
        mediaType: a.mediaType,
        width: a.width,
        height: a.height,
      }))
  }

  /**
   * Simple hash for generating storage keys for remote images
   */
  private hashUrl(url: string): string {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Parse age rating from ActivityPub sensitive flag and summary (CW text)
   *
   * Mastodon uses:
   * - sensitive: true for NSFW content
   * - summary: Content Warning text (often contains rating info)
   *
   * We parse the summary to determine specific ratings:
   * - "R-18G" or "R18G" → R18G
   * - "R-18" or "R18" → R18
   * - Otherwise sensitive → NSFW (default for unmarked sensitive content)
   * - Not sensitive → ALL_AGES
   */
  private parseAgeRatingFromSensitive(sensitive: boolean, summary?: string): 'ALL_AGES' | 'NSFW' | 'R18' | 'R18G' {
    if (!sensitive) {
      return 'ALL_AGES'
    }

    // Check summary for specific rating keywords
    const lowerSummary = (summary || '').toLowerCase()

    // Check for R-18G first (more specific)
    if (lowerSummary.includes('r-18g') || lowerSummary.includes('r18g')) {
      return 'R18G'
    }

    // Check for R-18
    if (lowerSummary.includes('r-18') || lowerSummary.includes('r18')) {
      return 'R18'
    }

    // Default: sensitive but no specific rating → NSFW
    return 'NSFW'
  }

  /**
   * Handle incoming Direct Message
   */
  private async handleDirectMessage(
    actorUrl: string,
    note: any,
    toField: string[],
    ccField: string[],
  ): Promise<void> {
    const noteId = note.id
    const content = note.content

    this.logger.debug(`Received DM from ${actorUrl}`)

    // Ensure remote sender exists
    const sender = await this.ensureRemoteActor(actorUrl)
    if (!sender) {
      this.logger.warn(`Could not resolve remote actor for DM: ${actorUrl}`)
      return
    }

    // Collect all participants (sender + all recipients)
    const allActorUrls = new Set<string>()
    allActorUrls.add(actorUrl) // Sender

    toField.forEach((addr) => {
      if (addr && !this.isPublicAddress(addr)) {
        allActorUrls.add(addr)
      }
    })

    ccField.forEach((addr) => {
      if (addr && !this.isPublicAddress(addr)) {
        allActorUrls.add(addr)
      }
    })

    if (allActorUrls.size !== 2) {
      this.logger.debug(`DM has ${allActorUrls.size} participants, only 1-on-1 supported for now`)
      return
    }

    const participants: User[] = []
    for (const url of allActorUrls) {
      let user: User | null = null
      if (url === actorUrl) {
        user = sender
        this.logger.debug(`DM participant (sender): ${url} -> ${sender.username}@${sender.domain}`)
      } else {
        const localUser = await this.findLocalUserByActorUrl(url)
        if (localUser) {
          user = localUser
          this.logger.debug(`DM participant (local by parsing): ${url} -> ${localUser.username}@${localUser.domain}`)
        } else {
          const existingUser = await this.prisma.user.findFirst({
            where: {
              actorUrl: url,
              domain: { not: '' },  // Only match remote users
            },
          })
          if (existingUser) {
            user = existingUser
            this.logger.debug(`DM participant (existing remote by actorUrl): ${url} -> ${existingUser.username}@${existingUser.domain}`)
          } else {
            user = await this.ensureRemoteActor(url)
            this.logger.debug(`DM participant (newly fetched remote): ${url} -> ${user?.username}@${user?.domain}`)
          }
        }
      }

      if (user) {
        participants.push(user)
      } else {
        this.logger.warn(`Could not resolve DM participant: ${url}`)
        return
      }
    }

    this.logger.debug(`DM participants domains: ${participants.map(p => `${p.username}@"${p.domain}"`).join(', ')}`)
    const hasLocalParticipant = participants.some((p) => p.domain === '')
    if (!hasLocalParticipant) {
      this.logger.debug('DM has no local participants, ignoring')
      return
    }

    const conversationId = await this.messagesService.findOrCreateConversationByActors(
      Array.from(allActorUrls),
    )

    if (!conversationId) {
      this.logger.warn('Could not find or create conversation for DM')
      return
    }

    const plainContent = this.stripHtml(content)

    // Create the message
    await this.messagesService.handleIncomingDM(sender.id, conversationId, plainContent, noteId)

    this.logger.log(`Received DM from ${sender.username}@${sender.domain}`)
  }

  /**
   * Check if an address is a public ActivityPub address
   */
  private isPublicAddress(addr: string): boolean {
    return addr === AP_PUBLIC || addr === 'as:Public' || addr === 'Public'
  }

  /**
   * Handle encrypted Direct Message (MLS over ActivityPub PrivateMessage)
   *
   * MLS over ActivityPub format:
   * {
   *   "type": ["Object", "PrivateMessage"],
   *   "mediaType": "message/mls",
   *   "encoding": "base64",
   *   "content": "[base64-encoded content]"
   * }
   *
   * In the full MLS implementation, the content would be MLS-encrypted ciphertext.
   * For Phase 3, we handle the placeholder format where content is base64-encoded plaintext.
   */
  private async handleEncryptedDirectMessage(
    actorUrl: string,
    privateMessage: any,
    activity: any,
  ): Promise<void> {
    const messageId = privateMessage.id
    const mediaType = privateMessage.mediaType
    const encoding = privateMessage.encoding
    const encodedContent = privateMessage.content
    const encryptionStatus = privateMessage['oib:encryptionStatus']

    this.logger.log(`Received encrypted DM from ${actorUrl} (status: ${encryptionStatus || 'unknown'})`)

    if (!messageId || !encodedContent) {
      this.logger.warn('PrivateMessage missing required fields (id, content)')
      return
    }

    let content: string

    if (mediaType === 'message/mls') {
      if (encryptionStatus === 'placeholder') {
        try {
          content = Buffer.from(encodedContent, 'base64').toString('utf8')
          this.logger.debug('Decoded placeholder MLS message (base64 plaintext)')
        } catch (err) {
          this.logger.warn(`Failed to decode base64 content: ${err.message}`)
          return
        }
      } else {
        this.logger.warn(`Unsupported MLS encryption status: ${encryptionStatus}. Full MLS decryption not yet implemented.`)
        try {
          content = Buffer.from(encodedContent, 'base64').toString('utf8')
          this.logger.debug('Decoded MLS message as fallback base64')
        } catch (err) {
          this.logger.warn(`Failed to decode content: ${err.message}`)
          return
        }
      }
    } else {
      content = encodedContent
    }

    const toField = Array.isArray(activity.to) ? activity.to : [activity.to].filter(Boolean)
    const ccField = Array.isArray(activity.cc) ? activity.cc : [activity.cc].filter(Boolean)

    await this.handleDirectMessage(actorUrl, {
      id: messageId,
      content,
      to: toField,
      cc: ccField,
      published: privateMessage.published,
    }, toField, ccField)
  }

  /**
   * Handle Delete activity
   * Handles deletion of remote artworks, users, comments, etc.
   */
  private async handleDelete(activity: any): Promise<void> {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id
    const objectUrl = typeof activity.object === 'string' ? activity.object : activity.object?.id

    if (!actorUrl || !objectUrl) {
      this.logger.warn('Delete activity missing actor or object')
      return
    }

    this.logger.debug(`Processing Delete activity from ${actorUrl} for ${objectUrl}`)

    const artwork = await this.prisma.artwork.findFirst({
      where: {
        apObjectId: objectUrl,
        federated: true,
      },
      include: {
        author: {
          select: { actorUrl: true },
        },
      },
    })

    if (artwork) {
      // Verify the actor is the artwork author
      if (artwork.author?.actorUrl !== actorUrl) {
        this.logger.warn(`Delete actor mismatch: ${actorUrl} is not the author of artwork ${artwork.id}`)
        return
      }

      // Soft delete the artwork
      await this.prisma.artwork.update({
        where: { id: artwork.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      })

      this.logger.log(`Soft deleted remote artwork: ${artwork.id} (${objectUrl})`)
      return
    }

    const comment = await this.prisma.comment.findFirst({
      where: {
        apActivityId: objectUrl,
        federated: true,
      },
      include: {
        user: {
          select: { actorUrl: true },
        },
        artwork: {
          select: { id: true },
        },
      },
    })

    if (comment) {
      if (comment.user?.actorUrl !== actorUrl) {
        this.logger.warn(`Delete actor mismatch: ${actorUrl} is not the author of comment ${comment.id}`)
        return
      }

      await this.prisma.$transaction([
        this.prisma.comment.delete({
          where: { id: comment.id },
        }),
        this.prisma.artwork.update({
          where: { id: comment.artwork.id },
          data: {
            commentCount: {
              decrement: 1,
            },
          },
        }),
      ])

      this.logger.log(`Deleted remote comment: ${comment.id} (${objectUrl})`)
      return
    }

    this.logger.debug(`No matching object found for Delete: ${objectUrl}`)
  }

  /**
   * Find a local user by parsing an actorUrl
   * Checks if the URL points to this instance and extracts the username
   * @param actorUrl - The actor URL to parse (e.g., https://domain/users/username)
   * @returns The local user if found, null otherwise
   */
  private async findLocalUserByActorUrl(actorUrl: string): Promise<User | null> {
    try {
      const url = new URL(actorUrl)
      const publicUrl = this.configService.get<string>('BASE_URL')

      this.logger.debug(`findLocalUserByActorUrl: actorUrl=${actorUrl}, BASE_URL=${publicUrl}`)

      if (!publicUrl) {
        this.logger.debug('findLocalUserByActorUrl: no publicUrl configured')
        return null
      }

      const publicUrlObj = new URL(publicUrl)

      if (url.hostname !== publicUrlObj.hostname) {
        this.logger.debug(`findLocalUserByActorUrl: hostname mismatch: ${url.hostname} !== ${publicUrlObj.hostname}`)
        return null
      }

      // Extract username from path (format: /users/username)
      const match = url.pathname.match(/^\/users\/([^\/]+)$/)
      if (!match) {
        this.logger.debug(`findLocalUserByActorUrl: path mismatch: ${url.pathname}`)
        return null
      }

      const username = match[1]
      this.logger.debug(`findLocalUserByActorUrl: looking for username=${username} with domain=''`)

      // Find local user (domain is empty string for local users)
      const localUser = await this.prisma.user.findFirst({
        where: {
          username,
          domain: '',
        },
      })

      this.logger.debug(`findLocalUserByActorUrl: found user=${localUser?.id || 'null'}`)
      return localUser
    } catch (error) {
      this.logger.debug(`findLocalUserByActorUrl: error=${error}`)
      return null
    }
  }

  /**
   * Handle Create activity for new artwork (Note with Image attachments)
   * This creates a RemoteArtwork record for artworks posted by remote users
   */
  private async handleCreateArtwork(actorUrl: string, note: any): Promise<void> {
    const objectId = typeof note.id === 'string' ? note.id : note.id?.id

    if (!objectId) {
      this.logger.warn('Artwork Create activity missing object id')
      return
    }

    const existing = await this.prisma.artwork.findFirst({
      where: { apObjectId: objectId },
    })

    if (existing) {
      this.logger.debug(`Remote artwork already exists: ${objectId}`)
      return
    }

    const remoteUser = await this.ensureRemoteActor(actorUrl)
    if (!remoteUser) {
      this.logger.warn(`Could not resolve remote actor for artwork: ${actorUrl}`)
      return
    }

    const title = note.name || this.extractTitleFromContent(note.content)
    const description = this.stripHtml(note.content || '')
    const sensitive = note.sensitive || false
    const attachments = note.attachment || []

    const disableRightClick = note['illustboard:disableRightClick']
    const customLicenseUrl = note['illustboard:customLicenseUrl']
    const customLicenseText = note['illustboard:customLicenseText']
    const license = note['illustboard:license']

    const tags: string[] = []
    if (note.tag && Array.isArray(note.tag)) {
      for (const tag of note.tag) {
        if (tag.type === 'Hashtag' && tag.name) {
          const tagName = tag.name.startsWith('#') ? tag.name.slice(1) : tag.name
          tags.push(tagName)
        }
      }
    }

    const hashUrl = (url: string) => crypto.createHash('sha256').update(url).digest('hex').substring(0, 16)

    try {
      await this.prisma.$transaction(async (tx) => {
        const artwork = await tx.artwork.create({
          data: {
            apObjectId: objectId,
            authorId: remoteUser.id,
            title: title || 'Untitled',
            description,
            ageRating: sensitive ? 'R18' : 'ALL_AGES',
            federated: true,
            publishedAt: note.published ? new Date(note.published) : new Date(),
            disableRightClick: disableRightClick !== undefined ? disableRightClick : true,
            customLicenseUrl: customLicenseUrl || null,
            customLicenseText: customLicenseText || null,
            license: license || null,
          },
        })

        let imageIndex = 0
        for (const att of attachments) {
          if (att.type !== 'Image' && !att.mediaType?.startsWith('image/')) {
            continue
          }

          await tx.artworkImage.create({
            data: {
              artworkId: artwork.id,
              url: att.url,
              thumbnailUrl: att.url,
              remoteUrl: att.url,
              width: 0,
              height: 0,
              originalWidth: att.width || null,
              originalHeight: att.height || null,
              order: imageIndex,
              storageKey: `remote:${hashUrl(objectId)}:${imageIndex}`,
              fileSize: 0,
              mimeType: att.mediaType || 'image/jpeg',
              originalFormat: 'jpeg',
              hasMetadata: false,
              wasResized: false,
              cacheStatus: RemoteImageCacheStatus.NOT_CACHED,
            },
          })
          imageIndex++
        }

        for (const tagName of tags) {
          let tag = await tx.tag.findFirst({ where: { name: tagName } })
          if (!tag) {
            tag = await tx.tag.create({
              data: {
                name: tagName,
                artworkCount: 0,
              },
            })
          }

          await tx.artworkTag.create({
            data: {
              artworkId: artwork.id,
              tagId: tag.id,
            },
          })
          await tx.tag.update({
            where: { id: tag.id },
            data: { artworkCount: { increment: 1 } },
          })
        }
      })

      this.logger.log(`Created remote artwork from Create activity: ${objectId} by ${remoteUser.username}@${remoteUser.domain}`)
    } catch (error) {
      this.logger.error(`Failed to create remote artwork: ${error.message}`)
    }
  }
}
