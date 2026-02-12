import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'
import { PrismaService } from '../../prisma/prisma.service'
import { OutboxService } from '../services/outbox.service'
import { Public } from '../../auth/decorators/public.decorator'
import { ConfigService } from '@nestjs/config'

/**
 * ActivityPub Artwork Controller
 *
 * Handles ActivityPub requests for artwork objects.
 * This endpoint is accessed when remote instances refresh artwork data.
 *
 * Endpoint: GET /ap/artworks/:id
 * Content-Type: application/activity+json
 *
 * Nginx routes /artworks/ to /api/ap/artworks/ when Accept header contains application/activity+json
 */
@Controller('ap/artworks')
export class ArtworksActivityPubController {
  private readonly logger = new Logger(ArtworksActivityPubController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get artwork as ActivityPub Note
   * GET /artworks/:id
   *
   * Returns the artwork as an ActivityPub Note object.
   * Only PUBLIC and UNLISTED artworks are accessible.
   */
  @Public()
  @Get(':id')
  async getArtwork(@Param('id') id: string, @Res() res: Response) {
    this.logger.debug(`ActivityPub request for artwork: ${id}`)

    // Find artwork with all necessary data
    const artwork = await this.prisma.artwork.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            domain: true,
            actorUrl: true,
          },
        },
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

    if (artwork.isDeleted) {
      throw new NotFoundException('Artwork has been deleted')
    }

    // Only PUBLIC and UNLISTED artworks are available via ActivityPub
    if (artwork.visibility !== 'PUBLIC' && artwork.visibility !== 'UNLISTED') {
      throw new NotFoundException('Artwork not found')
    }

    // Remote artworks should redirect to their origin
    if (artwork.apObjectId && artwork.author.domain) {
      this.logger.debug(`Redirecting to remote artwork: ${artwork.apObjectId}`)
      return res.redirect(301, artwork.apObjectId)
    }

    // Build actor URL
    const publicUrl = this.configService.get<string>('BASE_URL', '')
    const actorUrl = artwork.author.actorUrl || `${publicUrl}/users/${artwork.author.username}`

    // Convert to ActivityPub Note
    const note = this.outboxService.artworkToNote(artwork, actorUrl, publicUrl)

    // Add @context
    const response = {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        {
          illustboard: 'https://github.com/barineco/illo/ns#',
          'illustboard:disableRightClick': {
            '@id': 'illustboard:disableRightClick',
            '@type': '@json',
          },
          'illustboard:customLicenseUrl': {
            '@id': 'illustboard:customLicenseUrl',
            '@type': '@json',
          },
          'illustboard:customLicenseText': {
            '@id': 'illustboard:customLicenseText',
            '@type': '@json',
          },
          'illustboard:license': {
            '@id': 'illustboard:license',
            '@type': '@json',
          },
        },
      ],
      ...note,
    }

    res.setHeader('Content-Type', 'application/activity+json; charset=utf-8')
    res.json(response)
  }
}
