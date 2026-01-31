import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../prisma/prisma.service'
import { HttpSignatureService } from './http-signature.service'
import { ActorService } from './actor.service'
import { OutboxService } from './outbox.service'
import { NodeInfoCheckService } from './nodeinfo-check.service'
import { User, Comment, Artwork, Message } from '@prisma/client'
import { AP_CONTEXT, AP_PUBLIC } from '@illo/shared'
import { ACTIVITY_DELIVERY_QUEUE } from '../../queue/queue.module'
import { ACTIVITY_DELIVERY_JOB_OPTIONS } from '../../queue/backoff-strategies'
import { ActivityDeliveryJobData } from '../interfaces/activity-delivery-job.interface'

// MLS over ActivityPub context
const MLS_CONTEXT = 'https://purl.archive.org/socialweb/mls'

interface RemoteRecipient {
  id: string
  inbox: string | null
  actorUrl: string | null
  domain?: string
}

/**
 * Activity Delivery Service
 *
 * Sends ActivityPub activities to remote inboxes:
 * - Follow activities when following a remote user
 * - Undo Follow when unfollowing
 * - Like activities when liking remote artwork
 * - Undo Like when unliking
 */
@Injectable()
export class ActivityDeliveryService {
  private readonly logger = new Logger(ActivityDeliveryService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly httpSignature: HttpSignatureService,
    private readonly actorService: ActorService,
    private readonly outboxService: OutboxService,
    private readonly nodeInfoCheck: NodeInfoCheckService,
    @InjectQueue(ACTIVITY_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<ActivityDeliveryJobData>,
  ) {}

  /**
   * Send a Follow activity to a remote user's inbox
   */
  async sendFollow(follower: User, targetUser: User): Promise<boolean> {
    if (!targetUser.inbox || !targetUser.actorUrl) {
      this.logger.warn(`Target user ${targetUser.username}@${targetUser.domain} has no inbox`)
      return false
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${follower.username}`
    const activityId = `${actorUrl}#follows/${targetUser.id}/${Date.now()}`

    const activity = {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Follow',
      actor: actorUrl,
      object: targetUser.actorUrl,
    }

    return this.deliverActivity(follower, targetUser.inbox, activity)
  }

  /**
   * Send an Undo Follow activity to a remote user's inbox
   */
  async sendUndoFollow(follower: User, targetUser: User): Promise<boolean> {
    if (!targetUser.inbox || !targetUser.actorUrl) {
      this.logger.warn(`Target user ${targetUser.username}@${targetUser.domain} has no inbox`)
      return false
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${follower.username}`
    const activityId = `${actorUrl}#undo-follow/${targetUser.id}/${Date.now()}`

    const activity = {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Undo',
      actor: actorUrl,
      object: {
        type: 'Follow',
        actor: actorUrl,
        object: targetUser.actorUrl,
      },
    }

    return this.deliverActivity(follower, targetUser.inbox, activity)
  }

  /**
   * Send a Like activity to a remote inbox
   */
  async sendLike(liker: User, artworkApObjectId: string, targetInbox: string): Promise<boolean> {
    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${liker.username}`
    const activityId = `${actorUrl}#likes/${encodeURIComponent(artworkApObjectId)}/${Date.now()}`

    const activity = {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Like',
      actor: actorUrl,
      object: artworkApObjectId,
    }

    return this.deliverActivity(liker, targetInbox, activity)
  }

  /**
   * Send an Undo Like activity to a remote inbox
   */
  async sendUndoLike(liker: User, artworkApObjectId: string, targetInbox: string): Promise<boolean> {
    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${liker.username}`
    const activityId = `${actorUrl}#undo-like/${encodeURIComponent(artworkApObjectId)}/${Date.now()}`

    const activity = {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Undo',
      actor: actorUrl,
      object: {
        type: 'Like',
        actor: actorUrl,
        object: artworkApObjectId,
      },
    }

    return this.deliverActivity(liker, targetInbox, activity)
  }

  /**
   * Send an EmojiReact activity to a remote inbox (FEP-c0e0)
   * @see https://codeberg.org/fediverse/fep/src/branch/main/fep/c0e0/fep-c0e0.md
   */
  async sendEmojiReact(
    reactor: User,
    artworkApObjectId: string,
    emoji: string,
    targetInbox: string,
  ): Promise<boolean> {
    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${reactor.username}`
    const activityId = `${actorUrl}#emoji-react/${encodeURIComponent(artworkApObjectId)}/${encodeURIComponent(emoji)}/${Date.now()}`

    const activity = {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'EmojiReact',
      actor: actorUrl,
      object: artworkApObjectId,
      content: emoji,
    }

    return this.deliverActivity(reactor, targetInbox, activity)
  }

  /**
   * Send an Undo EmojiReact activity to a remote inbox
   */
  async sendUndoEmojiReact(
    reactor: User,
    artworkApObjectId: string,
    emoji: string,
    targetInbox: string,
  ): Promise<boolean> {
    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${reactor.username}`
    const activityId = `${actorUrl}#undo-emoji-react/${encodeURIComponent(artworkApObjectId)}/${encodeURIComponent(emoji)}/${Date.now()}`

    const activity = {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Undo',
      actor: actorUrl,
      object: {
        type: 'EmojiReact',
        actor: actorUrl,
        object: artworkApObjectId,
        content: emoji,
      },
    }

    return this.deliverActivity(reactor, targetInbox, activity)
  }

  /**
   * Send a Create activity for a comment (Note) to the artwork author's inbox
   */
  async sendCreateComment(
    commenter: User,
    comment: Comment & { artwork: Artwork & { author: User } },
  ): Promise<boolean> {
    const { artwork } = comment
    const { author } = artwork

    if (!author.domain || !author.inbox) {
      this.logger.debug(`Artwork author ${author.username} is local or has no inbox, skipping`)
      return false
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${commenter.username}`
    const noteId = `${publicUrl}/comments/${comment.id}`
    const artworkUrl = artwork.apObjectId || `${publicUrl}/artworks/${artwork.id}`
    const activityId = `${noteId}#create`

    // Build the Note object
    const noteObject = {
      id: noteId,
      type: 'Note',
      attributedTo: actorUrl,
      inReplyTo: artworkUrl,
      content: comment.content,
      published: comment.createdAt.toISOString(),
      to: [AP_PUBLIC],
      cc: [author.actorUrl],
    }

    const activity = {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Create',
      actor: actorUrl,
      published: comment.createdAt.toISOString(),
      to: [AP_PUBLIC],
      cc: [author.actorUrl],
      object: noteObject,
    }

    return this.deliverActivity(commenter, author.inbox, activity)
  }

  /**
   * Send an Accept activity in response to a Follow
   */
  async sendAcceptFollow(localUser: User, followActivity: any): Promise<boolean> {
    const actorUrl = typeof followActivity.actor === 'string' ? followActivity.actor : followActivity.actor?.id
    if (!actorUrl) {
      this.logger.warn('Cannot send Accept: missing actor in Follow activity')
      return false
    }

    const remoteUser = await this.prisma.user.findFirst({
      where: { actorUrl },
    })

    if (!remoteUser?.inbox) {
      this.logger.warn(`Cannot send Accept: remote user has no inbox: ${actorUrl}`)
      return false
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const localActorUrl = `${publicUrl}/users/${localUser.username}`
    const activityId = `${localActorUrl}#accepts/${Date.now()}`

    const activity = {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Accept',
      actor: localActorUrl,
      object: followActivity,
    }

    return this.deliverActivity(localUser, remoteUser.inbox, activity)
  }

  /**
   * Send an Update activity for an artwork to all remote followers
   *
   * Visibility-based delivery (Mastodon-compatible):
   * - PUBLIC: Deliver to all followers
   * - UNLISTED: Deliver to all followers
   * - FOLLOWERS_ONLY: Deliver to all followers
   * - PRIVATE: Should not be called (filtered by caller)
   */
  async sendUpdateArtwork(
    author: User,
    artwork: Artwork & { images: any[]; tags: any[]; visibility: string },
  ): Promise<void> {
    if (artwork.visibility === 'PRIVATE') {
      this.logger.debug(`Skipping Update activity for PRIVATE artwork ${artwork.id}`)
      return
    }

    const followers = await this.prisma.follow.findMany({
      where: {
        followingId: author.id,
        status: 'ACCEPTED',
        follower: {
          domain: { not: '' },
          inbox: { not: null },
        },
      },
      include: { follower: true },
    })

    if (followers.length === 0) {
      this.logger.debug(`No remote followers to notify for artwork ${artwork.id}`)
      return
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${author.username}`
    const objectUrl = artwork.apObjectId || `${publicUrl}/artworks/${artwork.id}`

    const note = this.outboxService.artworkToNote(artwork, actorUrl, publicUrl)

    const activity = {
      '@context': AP_CONTEXT,
      id: `${objectUrl}#updates/${Date.now()}`,
      type: 'Update',
      actor: actorUrl,
      published: new Date().toISOString(),
      to: note.to,
      cc: note.cc,
      object: note,
    }

    // Deliver to all remote followers' inboxes (async, don't wait)
    for (const follow of followers) {
      if (follow.follower.inbox) {
        this.deliverActivity(author, follow.follower.inbox, activity).catch((err) =>
          this.logger.error(`Failed to deliver Update to ${follow.follower.inbox}: ${err.message}`),
        )
      }
    }

    this.logger.log(
      `Sent Update activity for ${artwork.visibility} artwork ${artwork.id} to ${followers.length} remote followers`,
    )
  }

  /**
   * Send a Create activity for a new artwork to remote followers
   *
   * Visibility-based delivery (Mastodon-compatible):
   * - PUBLIC: Deliver to all followers (shown in public timelines)
   * - UNLISTED: Deliver to all followers (NOT shown in public timelines)
   * - FOLLOWERS_ONLY: Deliver to all followers
   * - PRIVATE: Do NOT deliver via ActivityPub
   */
  async sendCreateArtwork(
    author: User,
    artwork: Artwork & { images: any[]; tags: any[]; visibility: string },
  ): Promise<void> {
    if (artwork.visibility === 'PRIVATE') {
      this.logger.debug(`Skipping Create activity for PRIVATE artwork ${artwork.id}`)
      return
    }

    const followers = await this.prisma.follow.findMany({
      where: {
        followingId: author.id,
        status: 'ACCEPTED',
        follower: {
          domain: { not: '' },
          inbox: { not: null },
        },
      },
      include: { follower: true },
    })

    if (followers.length === 0) {
      this.logger.debug(`No remote followers to notify for new artwork ${artwork.id}`)
      return
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${author.username}`
    const objectUrl = `${publicUrl}/artworks/${artwork.id}`

    const note = this.outboxService.artworkToNote(artwork, actorUrl, publicUrl)

    const activity = {
      '@context': AP_CONTEXT,
      id: `${objectUrl}#create`,
      type: 'Create',
      actor: actorUrl,
      published: new Date().toISOString(),
      to: note.to,
      cc: note.cc,
      object: note,
    }

    for (const follow of followers) {
      if (follow.follower.inbox) {
        this.deliverActivity(author, follow.follower.inbox, activity).catch((err) =>
          this.logger.error(`Failed to deliver Create to ${follow.follower.inbox}: ${err.message}`),
        )
      }
    }

    this.logger.log(
      `Sent Create activity for ${artwork.visibility} artwork ${artwork.id} to ${followers.length} remote followers`,
    )
  }

  /**
   * Send a Direct Message to remote recipients
   * @returns Array of results with encryption status
   */
  async sendDirectMessage(
    sender: User,
    message: Message,
    remoteRecipients: RemoteRecipient[],
  ): Promise<{ success: boolean; encrypted: boolean }[]> {
    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${sender.username}`
    const noteId = `${publicUrl}/messages/${message.id}`
    const activityId = `${noteId}#create`

    const domains = remoteRecipients
      .filter((r) => r.domain)
      .map((r) => r.domain as string)
    const encryptionSupport = await this.nodeInfoCheck.checkEncryptionSupport(domains)

    const toRecipients = remoteRecipients
      .filter((r) => r.actorUrl)
      .map((r) => r.actorUrl as string)

    const results: { success: boolean; encrypted: boolean }[] = []

    for (const recipient of remoteRecipients) {
      if (!recipient.inbox) {
        results.push({ success: false, encrypted: false })
        continue
      }

      const isEncryptionSupported =
        recipient.domain && encryptionSupport.supportedDomains.includes(recipient.domain)

      let activity: any

      if (isEncryptionSupported) {
        activity = this.buildEncryptedDirectMessageActivity(
          actorUrl,
          noteId,
          activityId,
          message,
          toRecipients,
        )
        this.logger.log(`Sending encrypted DM to ${recipient.domain} (open-illustboard)`)
      } else {
        activity = this.buildPlainDirectMessageActivity(
          actorUrl,
          noteId,
          activityId,
          message,
          toRecipients,
        )
        this.logger.log(`Sending plain DM to ${recipient.domain} (non-OIB instance)`)
      }

      const success = await this.deliverActivity(sender, recipient.inbox, activity)
      results.push({ success, encrypted: isEncryptionSupported ?? false })
    }

    return results
  }

  /**
   * Build a plain ActivityPub Note for DM (for non-OIB instances)
   */
  private buildPlainDirectMessageActivity(
    actorUrl: string,
    noteId: string,
    activityId: string,
    message: Message,
    toRecipients: string[],
  ): any {
    const noteObject = {
      id: noteId,
      type: 'Note',
      attributedTo: actorUrl,
      content: message.content,
      published: message.createdAt.toISOString(),
      to: toRecipients,
      cc: [], // Empty - this is private
    }

    return {
      '@context': AP_CONTEXT,
      id: activityId,
      type: 'Create',
      actor: actorUrl,
      published: message.createdAt.toISOString(),
      to: toRecipients,
      cc: [],
      object: noteObject,
    }
  }

  /**
   * Build an MLS over ActivityPub encrypted message
   */
  private buildEncryptedDirectMessageActivity(
    actorUrl: string,
    noteId: string,
    activityId: string,
    message: Message,
    toRecipients: string[],
  ): any {
    const contentBase64 = Buffer.from(message.content, 'utf8').toString('base64')

    return {
      '@context': [AP_CONTEXT, MLS_CONTEXT],
      id: activityId,
      type: 'Create',
      actor: actorUrl,
      published: message.createdAt.toISOString(),
      to: toRecipients,
      cc: [],
      object: {
        type: ['Object', 'PrivateMessage'],
        id: noteId,
        attributedTo: actorUrl,
        mediaType: 'message/mls',
        encoding: 'base64',
        content: contentBase64,
        published: message.createdAt.toISOString(),
        to: toRecipients,
        'oib:encryptionStatus': 'placeholder',
      },
    }
  }

  /**
   * Deliver an activity to a remote inbox
   * Creates a delivery log and queues the job for processing with retries
   */
  private async deliverActivity(
    sender: User,
    inboxUrl: string,
    activity: any,
  ): Promise<boolean> {
    if (!sender.privateKey) {
      this.logger.error(`Sender ${sender.username} has no private key for signing`)
      return false
    }

    const activityType = activity.type || 'Unknown'
    const activityId = activity.id || null

    const deliveryLog = await this.prisma.activityDeliveryLog.create({
      data: {
        senderId: sender.id,
        inboxUrl,
        activityType,
        activityId,
        activityPayload: activity,
        status: 'PENDING',
      },
    })

    const success = await this.attemptDelivery(sender, inboxUrl, activity)

    if (success) {
      await this.prisma.activityDeliveryLog.update({
        where: { id: deliveryLog.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          attemptCount: 1,
          lastAttemptAt: new Date(),
        },
      })
      return true
    }

    await this.prisma.activityDeliveryLog.update({
      where: { id: deliveryLog.id },
      data: {
        attemptCount: 1,
        lastAttemptAt: new Date(),
        lastError: 'Initial attempt failed',
      },
    })

    const job = await this.deliveryQueue.add(
      `${activityType}-${deliveryLog.id}`,
      {
        deliveryLogId: deliveryLog.id,
        senderId: sender.id,
        inboxUrl,
        activity,
        activityType,
      },
      {
        ...ACTIVITY_DELIVERY_JOB_OPTIONS,
        delay: 60000, // First retry after 1 minute
      },
    )

    await this.prisma.activityDeliveryLog.update({
      where: { id: deliveryLog.id },
      data: { bullmqJobId: job.id },
    })

    this.logger.log(`Queued ${activityType} delivery to ${inboxUrl} (job: ${job.id})`)
    return false
  }

  /**
   * Attempt a single delivery to a remote inbox
   */
  private async attemptDelivery(sender: User, inboxUrl: string, activity: any): Promise<boolean> {
    try {
      const publicUrl = await this.actorService.getPublicUrl()
      const keyId = `${publicUrl}/users/${sender.username}#main-key`

      // Parse inbox URL
      const url = new URL(inboxUrl)
      const path = url.pathname + url.search
      const host = url.host

      // Sign the request
      const body = JSON.stringify(activity)
      const signatureHeaders = await this.httpSignature.signRequest({
        keyId,
        privateKeyPem: sender.privateKey!,
        method: 'POST',
        path,
        headers: { host },
        body,
      })

      this.logger.log(`Delivering ${activity.type} to ${inboxUrl}`)
      this.logger.debug(`Activity: ${body}`)

      // Send the request
      const response = await fetch(inboxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/activity+json',
          Accept: 'application/activity+json',
          Host: host,
          Date: signatureHeaders.date,
          Signature: signatureHeaders.signature,
          ...(signatureHeaders.digest ? { Digest: signatureHeaders.digest } : {}),
        },
        body,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        this.logger.warn(`Failed to deliver activity to ${inboxUrl}: ${response.status} ${text}`)
        return false
      }

      this.logger.log(`Successfully delivered ${activity.type} to ${inboxUrl}`)
      return true
    } catch (error) {
      this.logger.error(`Error delivering activity to ${inboxUrl}`, error)
      return false
    }
  }

  /**
   * Send an Update activity for user profile to all remote followers
   * Called when a local user updates their profile (displayName, bio, avatar, cover)
   */
  async sendUpdateProfile(user: User): Promise<void> {
    // Get remote followers
    const followers = await this.prisma.follow.findMany({
      where: {
        followingId: user.id,
        status: 'ACCEPTED',
        follower: {
          domain: { not: '' },
          inbox: { not: null },
        },
      },
      include: { follower: true },
    })

    if (followers.length === 0) {
      this.logger.debug(`No remote followers to notify for profile update of ${user.username}`)
      return
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${user.username}`

    // Build Actor object using ActorService
    const actorObject = await this.actorService.buildActorObject(user)

    // Build Update activity
    const activity = {
      '@context': AP_CONTEXT,
      id: `${actorUrl}#profile-updates/${Date.now()}`,
      type: 'Update',
      actor: actorUrl,
      published: new Date().toISOString(),
      to: [AP_PUBLIC],
      cc: [`${actorUrl}/followers`],
      object: actorObject,
    }

    for (const follow of followers) {
      if (follow.follower.inbox) {
        this.deliverActivity(user, follow.follower.inbox, activity).catch((err) =>
          this.logger.error(`Failed to deliver Profile Update to ${follow.follower.inbox}: ${err.message}`),
        )
      }
    }

    this.logger.log(`Sent Update activity for profile of ${user.username} to ${followers.length} remote followers`)
  }

  /**
   * Send Delete activity for artwork to all followers
   * Called when a local user deletes their artwork
   */
  async sendDeleteArtwork(
    author: { id: string; username: string; privateKey: string | null },
    artworkId: string,
  ): Promise<boolean[]> {
    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${author.username}`
    const objectUrl = `${publicUrl}/artworks/${artworkId}`

    const activity = {
      '@context': AP_CONTEXT,
      id: `${objectUrl}#delete-${Date.now()}`,
      type: 'Delete',
      actor: actorUrl,
      object: objectUrl,
    }

    const remoteFollowers = await this.prisma.follow.findMany({
      where: {
        followingId: author.id,
        follower: {
          domain: { not: '' },
          inbox: { not: null },
        },
      },
      include: {
        follower: {
          select: {
            inbox: true,
          },
        },
      },
    })

    if (remoteFollowers.length === 0) {
      this.logger.debug(`No remote followers to notify about artwork deletion`)
      return []
    }

    this.logger.log(`Sending Delete activity for artwork ${artworkId} to ${remoteFollowers.length} followers`)

    const fullAuthor = await this.prisma.user.findUnique({
      where: { id: author.id },
    })

    if (!fullAuthor) {
      this.logger.warn(`Author not found: ${author.id}`)
      return []
    }

    const results = await Promise.all(
      remoteFollowers.map((follow) =>
        this.deliverActivity(fullAuthor, follow.follower.inbox!, activity),
      ),
    )

    const successCount = results.filter((r) => r).length
    this.logger.log(`Delivered Delete to ${successCount}/${remoteFollowers.length} followers`)

    return results
  }
}
