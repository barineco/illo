import {
  Controller,
  Get,
  Param,
  Res,
  Req,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { PrismaService } from '../../prisma/prisma.service'
import { StorageService } from '../../storage/storage.service'
import { EncryptionService } from '../../storage/encryption.service'
import { HttpSignatureService } from '../services/http-signature.service'
import { RemoteFetchService } from '../services/remote-fetch.service'
import { ActorService } from '../services/actor.service'
import { RemoteImageCacheService } from '../services/remote-image-cache.service'
import { Public } from '../../auth/decorators/public.decorator'

/**
 * Federation Image Controller
 *
 * Serves artwork images for federation purposes with tiered access control:
 *
 * 1. GET /api/federation/images/:imageId
 *    - Returns THUMBNAIL (320px) only
 *    - PUBLIC/UNLISTED: No authentication required
 *    - FOLLOWERS_ONLY/PRIVATE: Rejected (not available for federation)
 *    - This is what external instances (Mastodon, etc.) receive
 *
 * 2. GET /api/federation/images/:imageId/standard
 *    - Returns STANDARD (2048px) version
 *    - Requires HTTP Signature authentication
 *    - Only illo instances are allowed
 *
 * 3. GET /api/federation/images/:imageId/original
 *    - Returns ORIGINAL version
 *    - Requires HTTP Signature authentication
 *    - Only illo instances are allowed
 *
 * Security:
 * - External crawlers can only access thumbnails (320px)
 * - High-resolution images are protected behind HTTP signature + illo verification
 */
@Controller('federation/images')
export class FederationImageController {
  private readonly logger = new Logger(FederationImageController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly encryptionService: EncryptionService,
    private readonly httpSignatureService: HttpSignatureService,
    private readonly remoteFetchService: RemoteFetchService,
    private readonly actorService: ActorService,
    private readonly remoteImageCacheService: RemoteImageCacheService,
  ) {}

  /**
   * Get thumbnail image for federation (320px)
   * GET /api/federation/images/:imageId
   *
   * This is the default endpoint that returns THUMBNAIL only.
   * PUBLIC/UNLISTED artworks are accessible without authentication.
   * External instances (Mastodon, etc.) will receive this thumbnail version.
   */
  @Public()
  @Get(':imageId')
  async getThumbnail(
    @Param('imageId') imageId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const image = await this.findImageWithArtwork(imageId)

    // Check if this is a remote image (not stored locally)
    if (image.storageKey.startsWith('remote:')) {
      throw new NotFoundException('Remote images cannot be served through this endpoint')
    }

    // PUBLIC/UNLISTED artworks: serve thumbnail without authentication
    if (image.artwork.visibility === 'PUBLIC' || image.artwork.visibility === 'UNLISTED') {
      return this.serveThumbnail(image, res)
    }

    // FOLLOWERS_ONLY/PRIVATE: not available for federation
    throw new ForbiddenException('This artwork is not available for public federation')
  }

  /**
   * Get standard image for federation (2048px)
   * GET /api/federation/images/:imageId/standard
   *
   * Requires HTTP Signature authentication from an illo instance.
   * This endpoint is used when remote illo users view artwork details.
   */
  @Public()
  @Get(':imageId/standard')
  async getStandard(
    @Param('imageId') imageId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const image = await this.findImageWithArtwork(imageId)

    // Check if this is a remote image (not stored locally)
    if (image.storageKey.startsWith('remote:')) {
      throw new NotFoundException('Remote images cannot be served through this endpoint')
    }

    // Verify HTTP Signature and illo instance
    await this.verifyOpenIllustboardRequest(req)

    // PUBLIC/UNLISTED: serve standard version
    if (image.artwork.visibility === 'PUBLIC' || image.artwork.visibility === 'UNLISTED') {
      return this.serveStandard(image, res)
    }

    // FOLLOWERS_ONLY/PRIVATE: not available even for illo instances (for now)
    throw new ForbiddenException('This artwork is not available for federation')
  }

  /**
   * Get original image for federation
   * GET /api/federation/images/:imageId/original
   *
   * Requires HTTP Signature authentication from an illo instance.
   * This endpoint is used when remote illo users view original resolution.
   */
  @Public()
  @Get(':imageId/original')
  async getOriginal(
    @Param('imageId') imageId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const image = await this.findImageWithArtwork(imageId)

    // Check if this is a remote image (not stored locally)
    if (image.storageKey.startsWith('remote:')) {
      throw new NotFoundException('Remote images cannot be served through this endpoint')
    }

    // Verify HTTP Signature and illo instance
    await this.verifyOpenIllustboardRequest(req)

    // PUBLIC/UNLISTED: serve original version
    if (image.artwork.visibility === 'PUBLIC' || image.artwork.visibility === 'UNLISTED') {
      return this.serveOriginal(image, res)
    }

    // FOLLOWERS_ONLY/PRIVATE: not available even for illo instances (for now)
    throw new ForbiddenException('This artwork is not available for federation')
  }

  /**
   * Find image with artwork data
   */
  private async findImageWithArtwork(imageId: string) {
    const image = await this.prisma.artworkImage.findUnique({
      where: { id: imageId },
      include: {
        artwork: {
          select: {
            id: true,
            visibility: true,
            isDeleted: true,
          },
        },
      },
    })

    if (!image || !image.artwork) {
      throw new NotFoundException('Image not found')
    }

    if (image.artwork.isDeleted) {
      throw new NotFoundException('Artwork has been deleted')
    }

    return image
  }

  /**
   * Verify HTTP Signature and ensure the requester is an illo instance
   */
  private async verifyOpenIllustboardRequest(req: Request): Promise<any> {
    const signatureHeader = req.headers['signature'] as string
    if (!signatureHeader) {
      throw new UnauthorizedException('HTTP Signature required for high-resolution images')
    }

    try {
      const actor = await this.verifyHttpSignature(req)

      // Verify the actor is from an illo instance
      if (!this.remoteFetchService.isOpenIllustboardActor(actor)) {
        this.logger.warn(`Rejected non-illo actor: ${actor.id}`)
        throw new ForbiddenException('Only illo instances can access high-resolution images')
      }

      return actor
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error
      }
      this.logger.error(`HTTP signature verification failed: ${error.message}`)
      throw new UnauthorizedException('Invalid HTTP Signature')
    }
  }

  /**
   * Serve thumbnail image (320px)
   */
  private async serveThumbnail(
    image: {
      storageKey: string
      thumbnailEncryptionIv: string | null
      mimeType: string | null
    },
    res: Response,
  ): Promise<void> {
    try {
      // Convert storage key to thumbnail key
      // Handle both standard format (xxx-standard.jpg) and SVG/GIF format (xxx-full.ext)
      const thumbnailKey = image.storageKey
        .replace('-standard.', '-thumb.')
        .replace('-full.', '-thumb.')
        .replace(/\.[^.]+$/, '.jpg')

      const imageData = await this.storageService.getObject(thumbnailKey)

      // Decrypt if encrypted
      let finalData = imageData
      if (this.encryptionService.isEnabled() && image.thumbnailEncryptionIv) {
        finalData = await this.encryptionService.decrypt(imageData, image.thumbnailEncryptionIv)
      }

      res.set({
        'Content-Type': 'image/jpeg', // Thumbnails are always JPEG
        'Content-Length': finalData.length.toString(),
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Federation-Source': 'illo',
        'X-Image-Variant': 'thumbnail',
      })

      res.send(finalData)
    } catch (error) {
      this.logger.error(`Failed to serve thumbnail: ${error.message}`)
      throw new NotFoundException('Failed to load image')
    }
  }

  /**
   * Serve standard image (2048px)
   */
  private async serveStandard(
    image: {
      storageKey: string
      encryptionIv: string | null
      mimeType: string | null
    },
    res: Response,
  ): Promise<void> {
    try {
      const imageData = await this.storageService.getObject(image.storageKey)

      // Decrypt if encrypted
      let finalData = imageData
      if (this.encryptionService.isEnabled() && image.encryptionIv) {
        finalData = await this.encryptionService.decrypt(imageData, image.encryptionIv)
      }

      res.set({
        'Content-Type': image.mimeType || 'image/jpeg',
        'Content-Length': finalData.length.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Federation-Source': 'illo',
        'X-Image-Variant': 'standard',
      })

      res.send(finalData)
    } catch (error) {
      this.logger.error(`Failed to serve standard image: ${error.message}`)
      throw new NotFoundException('Failed to load image')
    }
  }

  /**
   * Serve original image
   */
  private async serveOriginal(
    image: {
      originalStorageKey: string | null
      originalEncryptionIv: string | null
      mimeType: string | null
    },
    res: Response,
  ): Promise<void> {
    if (!image.originalStorageKey) {
      throw new NotFoundException('Original image not available')
    }

    try {
      const imageData = await this.storageService.getObject(image.originalStorageKey)

      // Decrypt if encrypted
      let finalData = imageData
      if (this.encryptionService.isEnabled() && image.originalEncryptionIv) {
        finalData = await this.encryptionService.decrypt(imageData, image.originalEncryptionIv)
      }

      res.set({
        'Content-Type': image.mimeType || 'image/jpeg',
        'Content-Length': finalData.length.toString(),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Federation-Source': 'illo',
        'X-Image-Variant': 'original',
      })

      res.send(finalData)
    } catch (error) {
      this.logger.error(`Failed to serve original image: ${error.message}`)
      throw new NotFoundException('Failed to load original image')
    }
  }

  /**
   * Verify HTTP Signature and return the signing actor
   */
  private async verifyHttpSignature(req: Request): Promise<any> {
    const signatureHeader = req.headers['signature'] as string
    if (!signatureHeader) {
      throw new UnauthorizedException('HTTP Signature required')
    }

    // Parse keyId from signature header
    const keyIdMatch = signatureHeader.match(/keyId="([^"]+)"/)
    if (!keyIdMatch) {
      throw new UnauthorizedException('Invalid signature: missing keyId')
    }

    const keyId = keyIdMatch[1]

    // Extract actor URL from keyId (e.g., "https://example.com/users/alice#main-key" -> "https://example.com/users/alice")
    const actorUrl = keyId.replace(/#.*$/, '')

    // Get actor credentials for signing our fetch request
    const credentials = await this.actorService.getSystemActorCredentials()

    // Fetch the actor to get their public key
    const actor = await this.remoteFetchService.fetchActor(actorUrl, {
      keyId: credentials.keyId,
      privateKey: credentials.privateKey,
    })

    if (!actor) {
      throw new UnauthorizedException('Failed to fetch actor')
    }

    // Get public key from actor
    const publicKeyPem = this.extractPublicKey(actor, keyId)
    if (!publicKeyPem) {
      throw new UnauthorizedException('Failed to extract public key from actor')
    }

    // Build headers for verification
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value
      } else if (Array.isArray(value) && value.length > 0) {
        headers[key.toLowerCase()] = value[0]
      }
    }

    // Get request path
    const path = req.originalUrl || req.url

    // Verify signature
    const isValid = await this.httpSignatureService.verifySignature({
      signature: signatureHeader,
      headers,
      publicKeyPem,
      method: req.method,
      path,
    })

    if (!isValid) {
      throw new UnauthorizedException('Invalid HTTP Signature')
    }

    return actor
  }

  /**
   * Extract public key PEM from actor object
   */
  private extractPublicKey(actor: any, keyId: string): string | null {
    // Handle single publicKey object
    if (actor.publicKey && actor.publicKey.id === keyId) {
      return actor.publicKey.publicKeyPem
    }

    // Handle array of publicKeys
    if (Array.isArray(actor.publicKey)) {
      const key = actor.publicKey.find((k: any) => k.id === keyId)
      if (key) {
        return key.publicKeyPem
      }
    }

    // Fallback: try to use publicKey if it matches the actor
    if (actor.publicKey?.publicKeyPem) {
      return actor.publicKey.publicKeyPem
    }

    return null
  }
}
