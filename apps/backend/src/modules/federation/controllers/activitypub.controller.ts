import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  Req,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Public } from '../../auth/decorators/public.decorator'
import { ActorService } from '../services/actor.service'
import { OutboxService } from '../services/outbox.service'
import { InboxService } from '../services/inbox.service'
import { FollowersCollectionService } from '../services/followers-collection.service'

/**
 * ActivityPub Controller
 * Handles ActivityPub-specific endpoints (inbox/outbox/followers/following)
 * Note: /users/:username is now handled by UsersController with content negotiation
 */
@Controller('users')
export class ActivityPubController {
  private readonly logger = new Logger(ActivityPubController.name)

  constructor(
    private readonly actorService: ActorService,
    private readonly outboxService: OutboxService,
    private readonly inboxService: InboxService,
    private readonly followersCollectionService: FollowersCollectionService,
  ) {}

  /**
   * Inbox endpoint - GET (for debugging/inspection)
   * GET /users/:username/inbox
   */
  @Public()
  @Get(':username/inbox')
  async getInbox(@Param('username') username: string) {
    // For now, just verify the user exists
    await this.actorService.getLocalActorByUsername(username)
    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: `${process.env.BASE_URL}/users/${username}/inbox`,
      totalItems: 0,
      orderedItems: [],
    }
  }

  /**
   * Inbox endpoint - POST (receive ActivityPub activities)
   * POST /users/:username/inbox
   *
   * Accepts: Follow, Undo, Like, Accept, Reject activities
   */
  @Public()
  @Post(':username/inbox')
  @HttpCode(HttpStatus.ACCEPTED)
  async postInbox(
    @Param('username') username: string,
    @Req() req: Request,
    @Body() body: any,
    @Res() res: Response,
  ) {
    this.logger.log(`Received activity for ${username}: ${body?.type}`)

    // Verify HTTP signature
    const isValid = await this.inboxService.verifyRequest(req, body)
    if (!isValid) {
      this.logger.warn(`Invalid or missing HTTP signature for inbox POST to ${username}`)
      this.logger.warn(`Request headers: ${JSON.stringify({
        signature: req.headers.signature,
        date: req.headers.date,
        host: req.headers.host,
        digest: req.headers.digest,
      })}`)
      throw new BadRequestException('Invalid or missing HTTP signature')
    }

    // Validate basic activity structure
    if (!body || !body.type) {
      throw new BadRequestException('Invalid activity: missing type')
    }

    // Process the activity asynchronously
    // Return 202 Accepted immediately, process in background
    try {
      await this.inboxService.processActivity(username, body)
    } catch (error) {
      this.logger.error(`Error processing activity: ${error}`)
      // Still return 202 - we accepted the request
    }

    return res.status(HttpStatus.ACCEPTED).json({ status: 'accepted' })
  }

  /**
   * Outbox endpoint - returns user's public artworks as ActivityPub activities
   * GET /users/:username/outbox
   * GET /users/:username/outbox?page=true - first page
   * GET /users/:username/outbox?page=2 - specific page
   */
  @Public()
  @Get(':username/outbox')
  async getOutbox(
    @Param('username') username: string,
    @Query('page') page: string | undefined,
    @Res() res: Response,
  ) {
    // Set ActivityPub content type
    res.setHeader('Content-Type', 'application/activity+json; charset=utf-8')

    // If no page requested, return the collection
    if (page === undefined) {
      const collection = await this.outboxService.getOutbox(username)
      return res.json(collection)
    }

    // If page=true or page=1, return first page
    if (page === 'true' || page === '1') {
      const pageData = await this.outboxService.getOutboxPage(username, 1)
      return res.json(pageData)
    }

    // Parse page number
    const pageNum = parseInt(page, 10)
    if (isNaN(pageNum) || pageNum < 1) {
      const pageData = await this.outboxService.getOutboxPage(username, 1)
      return res.json(pageData)
    }

    const pageData = await this.outboxService.getOutboxPage(username, pageNum)
    return res.json(pageData)
  }

  /**
   * Followers endpoint - returns user's followers as ActivityPub OrderedCollection
   * GET /users/:username/followers
   * GET /users/:username/followers?page=true - first page
   * GET /users/:username/followers?page=2 - specific page
   */
  @Public()
  @Get(':username/followers')
  async getFollowers(
    @Param('username') username: string,
    @Query('page') page: string | undefined,
    @Res() res: Response,
  ) {
    // Set ActivityPub content type
    res.setHeader('Content-Type', 'application/activity+json; charset=utf-8')

    // If no page requested, return the collection summary
    if (page === undefined) {
      const collection = await this.followersCollectionService.getFollowersCollection(username)
      return res.json(collection)
    }

    // If page=true or page=1, return first page
    if (page === 'true' || page === '1') {
      const pageData = await this.followersCollectionService.getFollowersPage(username, 1)
      return res.json(pageData)
    }

    // Parse page number
    const pageNum = parseInt(page, 10)
    if (isNaN(pageNum) || pageNum < 1) {
      const pageData = await this.followersCollectionService.getFollowersPage(username, 1)
      return res.json(pageData)
    }

    const pageData = await this.followersCollectionService.getFollowersPage(username, pageNum)
    return res.json(pageData)
  }

  /**
   * Following endpoint - returns users that the user is following as ActivityPub OrderedCollection
   * GET /users/:username/following
   * GET /users/:username/following?page=true - first page
   * GET /users/:username/following?page=2 - specific page
   */
  @Public()
  @Get(':username/following')
  async getFollowing(
    @Param('username') username: string,
    @Query('page') page: string | undefined,
    @Res() res: Response,
  ) {
    // Set ActivityPub content type
    res.setHeader('Content-Type', 'application/activity+json; charset=utf-8')

    // If no page requested, return the collection summary
    if (page === undefined) {
      const collection = await this.followersCollectionService.getFollowingCollection(username)
      return res.json(collection)
    }

    // If page=true or page=1, return first page
    if (page === 'true' || page === '1') {
      const pageData = await this.followersCollectionService.getFollowingPage(username, 1)
      return res.json(pageData)
    }

    // Parse page number
    const pageNum = parseInt(page, 10)
    if (isNaN(pageNum) || pageNum < 1) {
      const pageData = await this.followersCollectionService.getFollowingPage(username, 1)
      return res.json(pageData)
    }

    const pageData = await this.followersCollectionService.getFollowingPage(username, pageNum)
    return res.json(pageData)
  }
}
