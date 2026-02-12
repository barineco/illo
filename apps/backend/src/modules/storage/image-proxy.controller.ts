import {
  Controller,
  Get,
  Param,
  Res,
  Req,
  NotFoundException,
  ForbiddenException,
  Logger,
  Query,
  UseGuards,
  UseInterceptors,
  Inject,
  forwardRef,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from './storage.service'
import { EncryptionService } from './encryption.service'
import { ImageSigningService } from './image-signing.service'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { RateLimitGuard } from '../rate-limit/rate-limit.guard'
import { RateLimitInterceptor, shouldDegradeQuality } from '../rate-limit/rate-limit.interceptor'
import { RateLimit } from '../rate-limit/decorators/rate-limit.decorator'
import { RemoteImageCacheStatus, ArtworkImage } from '@prisma/client'
import { RemoteImageCacheService } from '../federation/services/remote-image-cache.service'
import { HeadlessDetectionGuard } from '../headless-detection/headless-detection.guard'
import { HeadlessDetectionService } from '../headless-detection/headless-detection.service'

/**
 * Image Proxy Controller
 *
 * Serves artwork images through the backend instead of direct MinIO access.
 * This provides:
 * - Access control based on artwork visibility
 * - Optional image decryption for encrypted storage
 * - Cache control headers
 * - Protection against direct URL scraping
 * - Signed URL verification for enhanced security
 */
@Controller('images')
export class ImageProxyController {
  private readonly logger = new Logger(ImageProxyController.name)

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private encryptionService: EncryptionService,
    private imageSigningService: ImageSigningService,
    private configService: ConfigService,
    @Inject(forwardRef(() => RemoteImageCacheService))
    private remoteImageCacheService: RemoteImageCacheService,
    private headlessDetectionService: HeadlessDetectionService,
  ) {}

  /**
   * Get signed URL for an image
   * GET /api/images/:imageId/signed-url
   *
   * Returns a time-limited signed URL for accessing the image.
   * Requires access permission to the artwork.
   * When rate limited, returns thumbnail URL instead of full image URL.
   */
  @Public()
  @Get(':imageId/signed-url')
  @UseGuards(HeadlessDetectionGuard, RateLimitGuard)
  @UseInterceptors(RateLimitInterceptor)
  @RateLimit({ action: 'image_fetch' })
  async getSignedUrl(
    @Param('imageId') imageId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
    @Query('thumb') thumbnail?: string,
    @Query('original') original?: string,
  ) {
    // Check if signed URLs are enabled
    if (!this.imageSigningService.isEnabled()) {
      throw new ForbiddenException('Signed URLs are not enabled')
    }

    // Find image and check access
    const image = await this.findImageWithAccessCheck(imageId, currentUser)

    // Check if original is requested but not available locally
    // For remote images, original will be proxied on-demand, so this is expected
    const requestedOriginal = original === 'true'
    if (requestedOriginal && !image.originalStorageKey) {
      this.logger.debug(`Original image will be proxied from remote for image ${imageId}`)
    }

    // Check if rate limited - force thumbnail if so
    const isRateLimited = shouldDegradeQuality(req)
    const requestedThumbnail = thumbnail === 'true'
    const forceThumbnail = isRateLimited && !requestedThumbnail

    // Generate signed URL
    // For remote images (storageKey starts with 'remote:' or has remoteUrl), original will be proxied on-demand
    const isRemoteImage = image.storageKey.startsWith('remote:') || !!image.remoteUrl
    let variant: 'thumbnail' | 'standard' | 'original' = 'standard'
    if (forceThumbnail || requestedThumbnail) {
      variant = 'thumbnail'
    } else if (requestedOriginal && (image.originalStorageKey || isRemoteImage)) {
      variant = 'original'
    }

    const result = this.imageSigningService.generateSignedUrlV2(imageId, variant)

    return {
      ...result,
      degraded: forceThumbnail,
      originalRequested: requestedOriginal,
      variant,
    }
  }

  /**
   * Get artwork image by image ID
   * GET /api/images/:imageId
   *
   * Public artworks are accessible without authentication.
   * Private/followers-only artworks require appropriate access.
   * When signed URLs are enabled, requires valid token and expiration.
   */
  @Public()
  @Get(':imageId')
  async getImage(
    @Param('imageId') imageId: string,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
    @Res() res: Response,
    @Query('thumb') thumbnail?: string,
    @Query('original') original?: string,
    @Query('token') token?: string,
    @Query('expires') expires?: string,
  ) {
    // Find image and related artwork
    const image = await this.prisma.artworkImage.findUnique({
      where: { id: imageId },
      include: {
        artwork: {
          select: {
            id: true,
            authorId: true,
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

    // Security check: signed URL verification OR hotlink protection + access check
    const isThumbnail = thumbnail === 'true'
    const isOriginal = original === 'true'

    // Determine variant (must match getSignedUrl logic for signature verification)
    const isRemoteImage = image.storageKey.startsWith('remote:') || !!image.remoteUrl
    let variant: 'thumbnail' | 'standard' | 'original' = 'standard'
    if (isThumbnail) {
      variant = 'thumbnail'
    } else if (isOriginal && (image.originalStorageKey || isRemoteImage)) {
      variant = 'original'
    }

    if (this.imageSigningService.isEnabled()) {
      // Signed URL mode
      if (token && expires) {
        // Token provided - verify it
        if (!this.imageSigningService.verifyTokenV2(imageId, variant, token, expires)) {
          // Invalid token - serve placeholder
          return this.serveProtectedPlaceholder(req, res)
        }
        // Valid signed URL - access granted
        // The signed URL was generated only after verifying access permissions

        // However, if this is a direct browser access (not from our frontend),
        // downgrade original to thumbnail to prevent URL sharing abuse
        if (variant === 'original' && !this.isValidImageRequest(req)) {
          this.logger.debug(`Direct access detected for original image ${imageId}, downgrading to thumbnail`)
          variant = 'thumbnail'
        }
      } else {
        // No token provided - require signed URL
        return this.serveProtectedPlaceholder(req, res)
      }
    } else {
      // Hotlink protection mode: check headers
      if (!this.isValidImageRequest(req)) {
        return this.serveProtectedPlaceholder(req, res)
      }

      // Check access permissions (only when signed URLs are disabled)
      const canAccess = await this.canAccessArtwork(image.artwork, currentUser)
      if (!canAccess) {
        throw new ForbiddenException('You do not have access to this artwork')
      }
    }

    try {
      // Check if this is a remote image (storageKey starts with 'remote:')
      if (image.storageKey.startsWith('remote:')) {
        return this.handleRemoteImage(image, variant, res)
      }

      // For cached remote images (have remoteUrl but storageKey is cache/...),
      // original variant should be proxied from remote server
      if (variant === 'original' && image.remoteUrl && !image.originalStorageKey) {
        return this.handleRemoteImage(image, variant, res)
      }

      // Get storage key and encryption IV based on variant
      let storageKey: string
      let encryptionIv: string | null

      if (variant === 'thumbnail') {
        storageKey = image.storageKey
          .replace('-standard.', '-thumb.')
          .replace('-full.', '-thumb.')
          .replace(/\.[^.]+$/, '.jpg')
        encryptionIv = image.thumbnailEncryptionIv
      } else if (variant === 'original' && image.originalStorageKey) {
        storageKey = image.originalStorageKey
        encryptionIv = image.originalEncryptionIv
      } else {
        // Standard version
        storageKey = image.storageKey
        encryptionIv = image.encryptionIv
      }

      // Fetch from MinIO
      const imageData = await this.storageService.getObject(storageKey)

      // If encryption is enabled and image is encrypted, decrypt it
      let finalData = imageData
      if (this.encryptionService.isEnabled() && encryptionIv) {
        finalData = await this.encryptionService.decrypt(imageData, encryptionIv)
      }

      // Set response headers
      // Thumbnail is always JPEG, regardless of original format
      const contentType = variant === 'thumbnail' ? 'image/jpeg' : (image.mimeType || 'image/jpeg')
      // Only cache thumbnails - standard and original should always be revalidated
      const cacheControl = variant === 'thumbnail' ? 'private, max-age=3600' : 'no-store'
      res.set({
        'Content-Type': contentType,
        'Content-Length': finalData.length.toString(),
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'",
      })

      res.send(finalData)
    } catch (error) {
      this.logger.error(`Failed to serve image ${imageId}: ${error.message}`)
      throw new NotFoundException('Failed to load image')
    }
  }

  /**
   * Find image and verify access permissions
   * Throws NotFoundException or ForbiddenException if access denied
   */
  private async findImageWithAccessCheck(imageId: string, currentUser: any) {
    const image = await this.prisma.artworkImage.findUnique({
      where: { id: imageId },
      include: {
        artwork: {
          select: {
            id: true,
            authorId: true,
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

    const canAccess = await this.canAccessArtwork(image.artwork, currentUser)
    if (!canAccess) {
      throw new ForbiddenException('You do not have access to this artwork')
    }

    return image
  }

  /**
   * Check if user can access the artwork
   */
  private async canAccessArtwork(
    artwork: { authorId: string; visibility: string },
    currentUser: any,
  ): Promise<boolean> {
    // Public and unlisted artworks are accessible to everyone
    if (artwork.visibility === 'PUBLIC' || artwork.visibility === 'UNLISTED') {
      return true
    }

    // Private artworks are only accessible to author
    if (artwork.visibility === 'PRIVATE') {
      return currentUser?.id === artwork.authorId
    }

    // Followers-only artworks
    if (artwork.visibility === 'FOLLOWERS_ONLY') {
      // Author can always access
      if (currentUser?.id === artwork.authorId) {
        return true
      }

      // Check if current user follows the author
      if (!currentUser) {
        return false
      }

      const follow = await this.prisma.follow.findFirst({
        where: {
          followerId: currentUser.id,
          followingId: artwork.authorId,
          status: 'ACCEPTED',
        },
      })

      return !!follow
    }

    return false
  }

  /**
   * Check if the image request is from an allowed origin (hotlink protection)
   * Uses Sec-Fetch-* headers (modern browsers) with Referer fallback
   */
  private isValidImageRequest(req: Request): boolean {
    // Check headless browser detection first
    const headlessResult = (req as any).headlessDetectionResult
    if (headlessResult && this.headlessDetectionService.isEnabled()) {
      const config = this.headlessDetectionService.getConfig()

      // If in measurement mode, only log but don't block
      if (!config.measurementMode) {
        // Block definite bots
        if (headlessResult.verdict === 'definite_bot') {
          this.logger.warn(`Blocking image request from definite bot (score: ${headlessResult.totalScore})`)
          return false
        }

        // Degrade quality for likely bots (return false to force placeholder)
        if (headlessResult.verdict === 'likely_bot') {
          this.logger.log(`Image request from likely bot (score: ${headlessResult.totalScore})`)
          // Don't block here, but the caller should handle quality degradation
        }
      }
    }

    // Check if hotlink protection is enabled
    const hotlinkProtection = this.configService.get<string>('IMAGE_HOTLINK_PROTECTION', 'true')
    if (hotlinkProtection !== 'true') {
      return true
    }

    const secFetchSite = req.headers['sec-fetch-site'] as string | undefined
    const secFetchDest = req.headers['sec-fetch-dest'] as string | undefined
    const secFetchMode = req.headers['sec-fetch-mode'] as string | undefined
    const origin = req.headers['origin'] as string | undefined
    const referer = req.headers['referer'] as string | undefined

    // 1. Sec-Fetch-Dest check
    if (secFetchDest) {
      const allowedDests = ['image', 'empty']
      if (!allowedDests.includes(secFetchDest)) {
        this.logger.debug(`Blocked request with Sec-Fetch-Dest: ${secFetchDest}`)
        return false
      }
    }

    // 2. Sec-Fetch-Mode check
    if (secFetchMode) {
      const blockedModes = ['navigate', 'websocket']
      if (blockedModes.includes(secFetchMode)) {
        this.logger.debug(`Blocked request with Sec-Fetch-Mode: ${secFetchMode}`)
        return false
      }
    }

    // 3. Sec-Fetch-Site check (modern browsers)
    if (secFetchSite) {
      // same-origin: request from the same origin (allowed)
      if (secFetchSite === 'same-origin') {
        return true
      }

      // same-site: request from same site but different subdomain (allowed)
      if (secFetchSite === 'same-site') {
        return true
      }

      // none: user directly navigated to URL (blocked)
      if (secFetchSite === 'none') {
        return false
      }

      // cross-site: check against allowed origins
      if (secFetchSite === 'cross-site') {
        if (origin) {
          const allowedOrigins = this.getAllowedOrigins()
          const isAllowedOrigin = allowedOrigins.some(allowed => {
            try {
              const allowedUrl = new URL(allowed)
              const originUrl = new URL(origin)
              return originUrl.hostname === allowedUrl.hostname
            } catch {
              return false
            }
          })
          if (isAllowedOrigin) {
            return true
          }
        }
        return false
      }
    }

    // 4. Origin header check (for CORS requests)
    if (origin) {
      const allowedOrigins = this.getAllowedOrigins()
      const isAllowed = allowedOrigins.some(allowed => {
        try {
          const allowedUrl = new URL(allowed)
          const originUrl = new URL(origin)
          return originUrl.hostname === allowedUrl.hostname
        } catch {
          return false
        }
      })
      if (isAllowed) {
        return true
      }
      this.logger.debug(`Blocked request from Origin: ${origin}`)
      return false
    }

    // 5. Referer fallback (older browsers)
    if (referer) {
      const allowedOrigins = this.getAllowedOrigins()
      try {
        const refererUrl = new URL(referer)
        return allowedOrigins.some(originStr => {
          try {
            const allowedUrl = new URL(originStr)
            return refererUrl.hostname === allowedUrl.hostname
          } catch {
            return false
          }
        })
      } catch {
        return false
      }
    }

    // 6. No Sec-Fetch-Site and no Referer
    const allowNoReferer = this.configService.get<string>('IMAGE_ALLOW_NO_REFERER', 'false')
    if (allowNoReferer !== 'true') {
      this.logger.debug('Blocked request with no Sec-Fetch-Site and no Referer (possible extension)')
    }
    return allowNoReferer === 'true'
  }

  /**
   * Get list of allowed origins for image requests
   */
  private getAllowedOrigins(): string[] {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', '')
    const additionalOrigins = this.configService.get<string>('IMAGE_ALLOWED_ORIGINS', '')

    const origins: string[] = []
    if (frontendUrl) {
      origins.push(frontendUrl)
    }
    if (additionalOrigins) {
      origins.push(...additionalOrigins.split(',').map(o => o.trim()).filter(Boolean))
    }
    return origins
  }

  /**
   * Serve a protected placeholder image when hotlink is detected
   * Returns 200 OK with placeholder to prevent crawler retries
   */
  private async serveProtectedPlaceholder(req: Request, res: Response): Promise<void> {
    // Determine language from Accept-Language header
    const acceptLang = req.headers['accept-language'] || ''
    const isJapanese = acceptLang.toLowerCase().includes('ja')

    // Get custom placeholder path or use default
    const customPath = this.configService.get<string>('IMAGE_PLACEHOLDER_PATH', '')

    let placeholderBuffer: Buffer

    if (customPath) {
      // Use custom placeholder
      try {
        placeholderBuffer = await fs.readFile(customPath)
      } catch (error) {
        this.logger.warn(`Custom placeholder not found at ${customPath}, using default`)
        placeholderBuffer = this.generateDefaultPlaceholder(isJapanese)
      }
    } else {
      // Use built-in placeholder based on language
      const placeholderName = isJapanese ? 'protected-image-ja.jpg' : 'protected-image-en.jpg'
      // Use process.cwd() for reliable path resolution in both dev and production
      const placeholderPath = path.join(process.cwd(), 'src/assets', placeholderName)

      try {
        placeholderBuffer = await fs.readFile(placeholderPath)
      } catch (error) {
        this.logger.warn(`Placeholder image not found at ${placeholderPath}, generating default`)
        placeholderBuffer = this.generateDefaultPlaceholder(isJapanese)
      }
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': placeholderBuffer.length.toString(),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
      'X-Image-Protected': 'true',
    })

    res.send(placeholderBuffer)
  }

  /**
   * Handle remote image request
   * Proxies the image from the remote server and triggers caching in background
   *
   * Strategy:
   * - thumbnail/standard: Cache locally, serve from cache if available
   * - original: Always proxy from remote (no caching to save storage)
   */
  private async handleRemoteImage(
    image: ArtworkImage,
    variant: 'thumbnail' | 'standard' | 'original',
    res: Response,
  ): Promise<void> {
    this.logger.debug(`Handling remote image: ${image.id}, variant: ${variant}`)

    // Original images are always proxied from remote (not cached)
    if (variant === 'original') {
      return this.proxyRemoteImageDirect(image, variant, res)
    }

    // Check cache status for thumbnail/standard
    if (image.cacheStatus === RemoteImageCacheStatus.CACHED) {
      // Image is cached - check if it's still in cache (storageKey should have been updated)
      if (!image.storageKey.startsWith('remote:')) {
        // Cached image - serve from storage
        return this.serveFromCache(image, variant, res)
      }
    }

    // Not cached or cache expired - proxy from remote and trigger caching
    try {
      // Trigger cache job in background (don't await)
      // This will cache both standard and thumbnail versions (not original)
      this.queueCacheJob(image.id).catch((err) => {
        this.logger.warn(`Failed to queue cache job for ${image.id}: ${err.message}`)
      })

      return this.proxyRemoteImageDirect(image, variant, res)
    } catch (error) {
      this.logger.error(`Failed to proxy remote image ${image.id}: ${error.message}`)
      throw new NotFoundException('Failed to load remote image')
    }
  }

  /**
   * Proxy remote image directly without caching
   */
  private async proxyRemoteImageDirect(
    image: ArtworkImage,
    variant: 'thumbnail' | 'standard' | 'original',
    res: Response,
  ): Promise<void> {
    // Get remote URL
    const remoteUrl = image.remoteUrl || image.url
    if (!remoteUrl || remoteUrl.startsWith('/api/images/')) {
      this.logger.error(`No valid remote URL for image ${image.id}`)
      throw new NotFoundException('Remote image URL not available')
    }

    // Proxy the image from remote with variant
    // - thumbnail: fetch from /api/federation/images/:id (no auth)
    // - standard:  fetch from /api/federation/images/:id/standard (HTTP signature)
    // - original:  fetch from /api/federation/images/:id/original (HTTP signature)
    const result = await this.remoteImageCacheService.proxyRemoteImage(image.id, variant)
    if (!result) {
      throw new NotFoundException('Failed to fetch remote image')
    }

    // Set response headers
    // Only cache thumbnails - standard and original should always be revalidated
    const cacheControl = variant === 'thumbnail' ? 'private, max-age=300' : 'no-store'
    res.set({
      'Content-Type': result.mimeType,
      'Content-Length': result.buffer.length.toString(),
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
      'X-Image-Source': 'remote-proxy',
      'X-Image-Variant': variant,
    })

    res.send(result.buffer)
  }

  /**
   * Serve image from cache (already cached remote image)
   */
  private async serveFromCache(
    image: ArtworkImage,
    variant: 'thumbnail' | 'standard' | 'original',
    res: Response,
  ): Promise<void> {
    let storageKey: string
    let encryptionIv: string | null

    if (variant === 'thumbnail') {
      storageKey = image.storageKey.replace('-standard.', '-thumb.')
      encryptionIv = image.thumbnailEncryptionIv
    } else {
      storageKey = image.storageKey
      encryptionIv = image.encryptionIv
    }

    const imageData = await this.storageService.getObject(storageKey)

    let finalData = imageData
    if (this.encryptionService.isEnabled() && encryptionIv) {
      finalData = await this.encryptionService.decrypt(imageData, encryptionIv)
    }

    const contentType = variant === 'thumbnail' ? 'image/jpeg' : (image.mimeType || 'image/jpeg')
    // Only cache thumbnails - standard and original should always be revalidated
    const cacheControl = variant === 'thumbnail' ? 'private, max-age=3600' : 'no-store'
    res.set({
      'Content-Type': contentType,
      'Content-Length': finalData.length.toString(),
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
      'X-Image-Source': 'cache',
    })

    res.send(finalData)
  }

  /**
   * Queue a cache job for the image
   */
  private async queueCacheJob(imageId: string): Promise<void> {
    try {
      // Use RemoteImageCacheService to queue the job
      await this.remoteImageCacheService.queueCacheJob(imageId)
    } catch (error) {
      this.logger.warn(`Failed to queue cache job for ${imageId}: ${error.message}`)
    }
  }

  /**
   * Generate a simple default placeholder image (1x1 gray pixel as fallback)
   * In production, proper placeholder images should be provided
   */
  private generateDefaultPlaceholder(isJapanese: boolean): Buffer {
    // Minimal 1x1 gray JPEG as ultimate fallback
    // In practice, the actual placeholder images should be created and placed in assets/
    const minimalJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
      0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
      0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
      0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
      0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
      0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
      0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xA8, 0xA8, 0x00,
      0x00, 0x00, 0x00, 0xFF, 0xD9,
    ])
    return minimalJpeg
  }
}
