import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import * as sharp from 'sharp'
import * as crypto from 'crypto'
import { Readable } from 'stream'
import { EncryptionService } from './encryption.service'
import {
  generateImageMetadata,
  generateSVGMetadata,
  detectImageFormat,
  getExtensionFromFormat,
  supportsSharpMetadata,
  MetadataInput,
} from './image-metadata.util'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

export interface UploadResult {
  url: string
  key: string
  bucket: string
  size: number
  contentType: string
  encryptionIv?: string  // Base64 encoded IV if encrypted
}

export interface ArtworkImageUploadResult {
  // 2048px version (detail page)
  standard: UploadResult & { width: number; height: number }
  // Thumbnail (320px)
  thumbnail: UploadResult & { width: number; height: number }
  // Full-size original (if size <= limit)
  original?: UploadResult & { width: number; height: number }
  // Format information
  originalFormat: string
  wasResized: boolean
  hasMetadata: boolean
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private minioClient: Minio.Client
  private readonly bucket: string
  private readonly publicUrl: string
  private readonly baseUrl: string

  constructor(
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost')
    const port = parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10)
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true'
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin')
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin')

    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'illustboard')
    this.publicUrl = this.configService.get<string>(
      'MINIO_PUBLIC_URL',
      `http://localhost:${port}`,
    )

    this.minioClient = new Minio.Client({
      endPoint: endpoint,
      port: port,
      useSSL: useSSL,
      accessKey: accessKey,
      secretKey: secretKey,
    })

    // Base URL for image proxy API (used when encryption is enabled)
    this.baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:11104')

    this.logger.log(`MinIO configured: ${endpoint}:${port}/${this.bucket}`)
    if (this.encryptionService.isEnabled()) {
      this.logger.log('Image encryption is enabled - images will be served via proxy API')
    }
  }

  /**
   * Check if image encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    return this.encryptionService.isEnabled()
  }

  async onModuleInit() {
    await this.ensureBucketExists()
  }

  /**
   * Ensure bucket exists, create if not
   *
   * IMPORTANT: The "private" bucket policy here refers to MinIO storage-level access control,
   * NOT artwork visibility settings (PUBLIC/PRIVATE/FOLLOWERS_ONLY).
   *
   * - MinIO "private" = Direct URL access to storage is blocked, images served through backend proxy
   * - Artwork visibility = Application-level access control checked in image-proxy.controller.ts
   *
   * When encryption is enabled:
   *   - MinIO bucket: PRIVATE (no direct URL access)
   *   - All images served through /api/images/:id which checks artwork visibility
   *
   * When encryption is disabled (development):
   *   - MinIO bucket: PUBLIC READ (direct URL access allowed)
   *   - Artwork visibility still applies at API level, but direct URLs bypass it
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket)
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket, 'us-east-1')
        this.logger.log(`Bucket created: ${this.bucket}`)
      } else {
        this.logger.log(`Bucket exists: ${this.bucket}`)
      }

      // Set bucket policy based on encryption status
      if (this.encryptionService.isEnabled()) {
        // Hybrid policy: users/ and og-cards/ public, artworks/ private
        // - users/* (avatars, covers): Public read for ActivityPub federation compatibility
        // - og-cards/* (OG card images): Public read for social media crawlers (Twitter, Discord, etc.)
        // - artworks/*: Private, served through proxy API with decryption
        try {
          const hybridPolicy = {
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'AllowPublicReadForUserProfiles',
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [
                  `arn:aws:s3:::${this.bucket}/users/*`,
                  `arn:aws:s3:::${this.bucket}/og-cards/*`,
                ],
              },
              // Note: artworks/* has no Allow statement = effectively private
              // Only authenticated MinIO clients (backend service) can access
            ],
          }
          await this.minioClient.setBucketPolicy(
            this.bucket,
            JSON.stringify(hybridPolicy),
          )
          this.logger.log(`Bucket policy set to HYBRID for: ${this.bucket} (users/* public, artworks/* private)`)
        } catch (policyError) {
          this.logger.warn(`Could not set hybrid policy: ${policyError.message}`)
        }
      } else {
        // Public read access (development mode without encryption)
        const publicPolicy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        }
        await this.minioClient.setBucketPolicy(
          this.bucket,
          JSON.stringify(publicPolicy),
        )
        this.logger.log(`Bucket policy set to PUBLIC READ for: ${this.bucket} (no encryption)`)
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket exists: ${error.message}`, error.stack)
    }
  }

  /**
   * Upload file to MinIO
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<UploadResult> {
    const key = `${folder}/${Date.now()}-${file.originalname}`

    try {
      await this.minioClient.putObject(
        this.bucket,
        key,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
        },
      )

      const url = `${this.publicUrl}/${this.bucket}/${key}`

      this.logger.log(`File uploaded: ${key}`)

      return {
        url,
        key,
        bucket: this.bucket,
        size: file.size,
        contentType: file.mimetype,
      }
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack)
      throw new Error(`Failed to upload file: ${error.message}`)
    }
  }

  /**
   * Upload profile image (avatar or cover) WITHOUT encryption
   * - Strips EXIF metadata for privacy
   * - Resizes image
   * - Returns direct MinIO URL (for ActivityPub compatibility)
   *
   * This method intentionally does NOT encrypt images because:
   * 1. Avatar/cover are public profile information
   * 2. ActivityPub requires direct URL access from remote instances
   * 3. These URLs are shared in Actor objects across the Fediverse
   */
  async uploadProfileImage(
    file: Express.Multer.File,
    folder: string,
    maxWidth: number = 800,
    quality: number = 85,
    cropRegion?: { x: number; y: number; width: number; height: number },
  ): Promise<{
    url: string
    key: string
    width: number
    height: number
  }> {
    const timestamp = Date.now()
    const baseName = file.originalname.replace(/\.[^/.]+$/, '')

    // Start with sharp pipeline
    let pipeline = sharp(file.buffer).rotate() // Apply EXIF orientation

    // Apply crop region if provided
    if (cropRegion) {
      pipeline = pipeline.extract({
        left: Math.round(cropRegion.x),
        top: Math.round(cropRegion.y),
        width: Math.round(cropRegion.width),
        height: Math.round(cropRegion.height),
      })
    }

    // Process image: resize and compress
    const { data: processedBuffer, info } = await pipeline
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality })
      .toBuffer({ resolveWithObject: true })

    const key = `${folder}/${timestamp}-${baseName}.jpg`

    // Upload WITHOUT encryption - direct MinIO access
    await this.minioClient.putObject(
      this.bucket,
      key,
      processedBuffer,
      processedBuffer.length,
      {
        'Content-Type': 'image/jpeg',
      },
    )

    const url = `${this.publicUrl}/${this.bucket}/${key}`

    this.logger.log(`Profile image uploaded: ${key} (${info.width}x${info.height}, NOT encrypted)`)

    return {
      url,
      key,
      width: info.width,
      height: info.height,
    }
  }

  /**
   * Generate and upload OG card image with text overlay
   * - Crops source image to specified region
   * - Resizes to 320x180 (16:9)
   * - Applies blur if requested (for R18+ content)
   * - Adds gradient overlay and text (title + username)
   * - Returns direct MinIO URL (NOT encrypted, for OG meta tags)
   */
  async generateOgCard(
    sourceImageBuffer: Buffer,
    cropRegion: { x: number; y: number; width: number; height: number },
    options: { blur: boolean },
    artworkId: string,
  ): Promise<{ url: string; key: string; width: number; height: number }> {
    // 1. Extract crop region and resize to 320x180
    let pipeline = sharp(sourceImageBuffer)
      .extract({
        left: Math.round(cropRegion.x),
        top: Math.round(cropRegion.y),
        width: Math.round(cropRegion.width),
        height: Math.round(cropRegion.height),
      })
      .resize(320, 180, { fit: 'cover', position: 'center' })

    // 2. Apply blur if requested (R18+ content)
    if (options.blur) {
      pipeline = pipeline.blur(10) // Gaussian blur, sigma=10
    }

    // 3. Get final image buffer
    const finalBuffer = await pipeline.jpeg({ quality: 85 }).toBuffer()

    // 4. Upload to MinIO (public, unencrypted)
    const key = `og-cards/${artworkId}.jpg`
    await this.minioClient.putObject(
      this.bucket,
      key,
      finalBuffer,
      finalBuffer.length,
      {
        'Content-Type': 'image/jpeg',
      },
    )

    const url = `${this.publicUrl}/${this.bucket}/${key}`

    this.logger.log(`OG card generated: ${key} (320x180, NOT encrypted)`)

    return { url, key, width: 320, height: 180 }
  }

  /**
   * Upload and process Link Card image (direct upload with auto-crop)
   * - Automatically crops to 16:9 if needed (center crop)
   * - Resizes to exactly 320x180px
   * - Applies blur if requested (for R18/R18G content)
   * - Returns direct MinIO URL (NOT encrypted, for OG meta tags)
   */
  async uploadLinkCard(
    file: Express.Multer.File,
    blur: boolean,
    artworkId: string,
  ): Promise<{ url: string; key: string; width: number; height: number }> {
    // 1. Resize to 320x180 with center crop (automatically handles any aspect ratio)
    let pipeline = sharp(file.buffer)
      .resize(320, 180, { fit: 'cover', position: 'center' })

    // 2. Apply blur if requested (before encoding)
    if (blur) {
      pipeline = pipeline.blur(20) // Gaussian blur, sigma=20
    }

    // 3. Encode as JPEG
    pipeline = pipeline.jpeg({ quality: 85 })

    const buffer = await pipeline.toBuffer()

    // 3. Upload to MinIO (public read, NOT encrypted)
    const key = `og-cards/${artworkId}.jpg`
    await this.minioClient.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': 'image/jpeg',
    })

    const url = `${this.publicUrl}/${this.bucket}/${key}`

    this.logger.log(
      `Link Card uploaded: ${key} (320x180${blur ? ', blurred' : ''}, NOT encrypted)`,
    )

    return { url, key, width: 320, height: 180 }
  }

  /**
   * Upload artwork image with thumbnail generation
   * - Strips all EXIF/IPTC/XMP metadata for privacy protection
   * - Applies EXIF orientation before stripping to preserve correct image orientation
   * - Returns image dimensions (width, height) for both original and thumbnail
   * - When encryption is enabled, images are encrypted before storage
   *   and URLs point to the proxy API instead of direct MinIO access
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'images',
    maxWidth: number = 2048,
    thumbnailWidth: number = 320,
  ): Promise<{
    original: UploadResult & { width: number; height: number }
    thumbnail: UploadResult & { width: number; height: number }
  }> {
    const encryptionEnabled = this.encryptionService.isEnabled()
    const timestamp = Date.now()
    const baseName = file.originalname.replace(/\.[^/.]+$/, '')

    // Process original image
    // - .rotate() applies EXIF orientation and removes the orientation tag
    // - No .withMetadata() call = all EXIF/IPTC/XMP data is stripped
    const { data: originalBuffer, info: originalInfo } = await sharp(file.buffer)
      .rotate() // Apply EXIF orientation, then strip all metadata
      .resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true })

    const originalKey = `${folder}/${timestamp}-original-${baseName}.jpg`

    // Encrypt and upload original
    let originalEncryptionIv: string | undefined
    if (encryptionEnabled) {
      const { encrypted, iv } = await this.encryptionService.encrypt(originalBuffer)
      originalEncryptionIv = iv
      await this.minioClient.putObject(
        this.bucket,
        originalKey,
        encrypted,
        encrypted.length,
        {
          'Content-Type': 'application/octet-stream', // Encrypted data
        },
      )
    } else {
      await this.minioClient.putObject(
        this.bucket,
        originalKey,
        originalBuffer,
        originalBuffer.length,
        {
          'Content-Type': 'image/jpeg',
        },
      )
    }

    // Generate thumbnail (also strip metadata)
    const { data: thumbnailBuffer, info: thumbnailInfo } = await sharp(file.buffer)
      .rotate() // Apply EXIF orientation, then strip all metadata
      .resize(thumbnailWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true })

    const thumbnailKey = `${folder}/${timestamp}-thumb-${baseName}.jpg`

    // Encrypt and upload thumbnail
    let thumbnailEncryptionIv: string | undefined
    if (encryptionEnabled) {
      const { encrypted, iv } = await this.encryptionService.encrypt(thumbnailBuffer)
      thumbnailEncryptionIv = iv
      await this.minioClient.putObject(
        this.bucket,
        thumbnailKey,
        encrypted,
        encrypted.length,
        {
          'Content-Type': 'application/octet-stream', // Encrypted data
        },
      )
    } else {
      await this.minioClient.putObject(
        this.bucket,
        thumbnailKey,
        thumbnailBuffer,
        thumbnailBuffer.length,
        {
          'Content-Type': 'image/jpeg',
        },
      )
    }

    const encryptedSuffix = encryptionEnabled ? ', encrypted' : ''
    this.logger.log(`Image uploaded: ${originalKey} (${originalInfo.width}x${originalInfo.height}, with thumbnail, metadata stripped${encryptedSuffix})`)

    // Note: URLs are NOT returned here - they will be set by artworks.service.ts
    // based on the imageId after the database record is created
    // For now, return placeholder URLs that will be ignored
    return {
      original: {
        url: '', // URL will be set after database record creation
        key: originalKey,
        bucket: this.bucket,
        size: originalBuffer.length,
        contentType: 'image/jpeg',
        width: originalInfo.width,
        height: originalInfo.height,
        encryptionIv: originalEncryptionIv,
      },
      thumbnail: {
        url: '', // URL will be set after database record creation
        key: thumbnailKey,
        bucket: this.bucket,
        size: thumbnailBuffer.length,
        contentType: 'image/jpeg',
        width: thumbnailInfo.width,
        height: thumbnailInfo.height,
        encryptionIv: thumbnailEncryptionIv,
      },
    }
  }

  /**
   * Generate image URL based on encryption status
   * - Encrypted images: /api/images/:imageId (proxy API)
   * - Unencrypted images: direct MinIO URL
   */
  getImageUrl(imageId: string, thumbnail: boolean = false): string {
    if (this.encryptionService.isEnabled()) {
      const baseApiUrl = this.baseUrl.replace(/\/$/, '')
      const thumbParam = thumbnail ? '?thumb=true' : ''
      return `${baseApiUrl}/api/images/${imageId}${thumbParam}`
    } else {
      // For unencrypted mode, we need the storage key
      // This method should only be called for encrypted mode
      // For unencrypted mode, use getFileUrl with the storage key
      throw new Error('getImageUrl should only be called when encryption is enabled')
    }
  }

  /**
   * Generate direct MinIO URL for unencrypted images
   */
  getDirectImageUrl(storageKey: string): string {
    return `${this.publicUrl}/${this.bucket}/${storageKey}`
  }

  /**
   * Upload artwork image with format preservation and metadata embedding
   *
   * Strategy:
   * - ORIGINAL (for viewer): Always save with metadata, no conversion, no resize
   * - STANDARD (for detail page): SVG/GIF/WebP use original, PNG/JPG/TIFF convert to JPEG 2048px
   * - THUMBNAIL: Always JPEG 320px
   *
   * @param file - Uploaded file from multer
   * @param folder - MinIO folder (e.g., 'artworks')
   * @param metadataInput - Author and artwork information for metadata embedding
   */
  async uploadArtworkImage(
    file: Express.Multer.File,
    folder: string = 'artworks',
    metadataInput: MetadataInput,
  ): Promise<ArtworkImageUploadResult> {
    const encryptionEnabled = this.encryptionService.isEnabled()
    const timestamp = Date.now()
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex').substring(0, 8)
    const uniqueId = `${timestamp}-${hash}`

    // Configuration from environment variables
    // maxLongEdge: the maximum size for the longest edge of the image
    const maxLongEdge = parseInt(
      this.configService.get<string>('IMAGE_DEFAULT_MAX_LONG_EDGE', '2048'),
      10,
    )
    const thumbnailWidth = 320
    const preserveFormat = this.configService.get<string>('IMAGE_PRESERVE_FORMAT', 'true') === 'true'
    const embedMetadata = this.configService.get<string>('IMAGE_EMBED_METADATA', 'true') === 'true'

    // Detect image format
    const detectedFormat = detectImageFormat(file.mimetype)
    if (!detectedFormat) {
      throw new Error(`Unsupported image format: ${file.mimetype}`)
    }

    const format = preserveFormat ? detectedFormat : 'jpeg'
    const fileSizeInMB = file.size / (1024 * 1024)

    this.logger.log(
      `Processing ${format} image: ${fileSizeInMB.toFixed(2)}MB`,
    )

    // Generate metadata for embedding
    const metadata = embedMetadata ? generateImageMetadata(metadataInput) : undefined

    // === ORIGINAL VERSION (for viewer - always save) ===
    let originalResult: (UploadResult & { width: number; height: number })

    if (format === 'svg') {
      // SVG: Embed metadata in <metadata> tag
      originalResult = await this.processSVG(
        file.buffer,
        folder,
        uniqueId,
        'full',
        metadataInput,
        embedMetadata,
        encryptionEnabled,
      )
    } else if (format === 'gif') {
      // GIF: Save as-is to preserve animation (sharp would lose frames)
      // Use sharp only to get dimensions, with animated: true to read all frames
      const gifMetadata = await sharp(file.buffer, { animated: true }).metadata()
      const extension = getExtensionFromFormat(format)
      const fullSizeKey = `${folder}/${uniqueId}-full.${extension}`

      originalResult = await this.uploadBuffer(
        file.buffer, // Use original buffer directly to preserve animation
        fullSizeKey,
        `image/${format}`,
        gifMetadata.width || 0,
        gifMetadata.height || 0,
        encryptionEnabled,
      )
    } else {
      // Raster formats: Save original with metadata only, no conversion
      const { data, info } = await sharp(file.buffer)
        .rotate() // Apply EXIF orientation
        .toBuffer({ resolveWithObject: true })

      const extension = getExtensionFromFormat(format)
      const fullSizeKey = `${folder}/${uniqueId}-full.${extension}`

      // Re-encode with metadata if needed
      let processedBuffer: Buffer
      if (embedMetadata && supportsSharpMetadata(format)) {
        const sharpInstance = sharp(data)
        processedBuffer = await this.encodeWithMetadata(sharpInstance, format, metadata!)
      } else {
        processedBuffer = data
      }

      originalResult = await this.uploadBuffer(
        processedBuffer,
        fullSizeKey,
        `image/${format}`,
        info.width,
        info.height,
        encryptionEnabled,
      )
    }

    // === STANDARD VERSION (for detail page) ===
    // SVG/GIF/WebP: use original
    // PNG/JPG/TIFF: convert to JPEG 2048px with metadata
    let standardResult: UploadResult & { width: number; height: number }
    let wasResized = false

    const useOriginalForStandard = ['svg', 'gif', 'webp'].includes(format)

    if (useOriginalForStandard) {
      // Use original for standard (SVG/GIF/WebP)
      standardResult = originalResult
    } else {
      // Convert to JPEG with long edge constrained to maxLongEdge for PNG/JPG/TIFF
      standardResult = await this.processStandardImage(
        file.buffer,
        'jpeg', // Always JPEG for standard version
        folder,
        uniqueId,
        maxLongEdge,
        metadata,
        embedMetadata,
        encryptionEnabled,
      )

      // Check if resized
      if (standardResult.width < originalResult.width || standardResult.height < originalResult.height) {
        wasResized = true
      }
    }

    // === 320px THUMBNAIL ===
    const thumbnailResult = await this.processThumbnail(
      file.buffer,
      folder,
      uniqueId,
      thumbnailWidth,
      encryptionEnabled,
      format,
    )

    return {
      original: originalResult,
      standard: standardResult,
      thumbnail: thumbnailResult,
      originalFormat: format,
      wasResized,
      hasMetadata: embedMetadata,
    }
  }

  /**
   * Process SVG file with metadata embedding
   */
  private async processSVG(
    buffer: Buffer,
    folder: string,
    uniqueId: string,
    variant: 'full' | 'standard',
    metadataInput: MetadataInput,
    embedMetadata: boolean,
    encryptionEnabled: boolean,
  ): Promise<UploadResult & { width: number; height: number }> {
    const svgString = buffer.toString('utf-8')
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')

    // Embed metadata if requested
    if (embedMetadata) {
      const svgElement = doc.documentElement
      const metadataXml = generateSVGMetadata(metadataInput)
      const metadataDoc = parser.parseFromString(metadataXml, 'application/xml')
      const metadataElement = metadataDoc.documentElement

      // Insert metadata as first child of SVG
      svgElement.insertBefore(metadataElement, svgElement.firstChild)
    }

    const serializer = new XMLSerializer()
    const modifiedSvg = serializer.serializeToString(doc)
    const modifiedBuffer = Buffer.from(modifiedSvg, 'utf-8')

    // Extract dimensions (default to 1000x1000 if not specified)
    const svgElement = doc.documentElement
    const width = parseInt(svgElement.getAttribute('width') || '1000', 10)
    const height = parseInt(svgElement.getAttribute('height') || '1000', 10)

    const key = `${folder}/${uniqueId}-${variant}.svg`

    return this.uploadBuffer(
      modifiedBuffer,
      key,
      'image/svg+xml',
      width,
      height,
      encryptionEnabled,
    )
  }

  /**
   * Process standard (2048px long edge) version
   */
  private async processStandardImage(
    buffer: Buffer,
    format: string,
    folder: string,
    uniqueId: string,
    maxLongEdge: number,
    metadata: any,
    embedMetadata: boolean,
    encryptionEnabled: boolean,
  ): Promise<UploadResult & { width: number; height: number }> {
    const extension = getExtensionFromFormat(format)

    let sharpInstance = sharp(buffer).rotate()

    // Resize to max long edge (both width and height constrained to maxLongEdge)
    // fit: 'inside' ensures the image fits within maxLongEdge x maxLongEdge box
    sharpInstance = sharpInstance.resize(maxLongEdge, maxLongEdge, {
      withoutEnlargement: true,
      fit: 'inside',
    })

    // Encode with metadata if supported
    let processedBuffer: Buffer
    let info: sharp.OutputInfo

    if (embedMetadata && supportsSharpMetadata(format)) {
      processedBuffer = await this.encodeWithMetadata(sharpInstance, format, metadata)
      const tempInfo = await sharp(processedBuffer).metadata()
      info = { width: tempInfo.width!, height: tempInfo.height!, format: tempInfo.format! } as sharp.OutputInfo
    } else {
      const result = await this.encodeImage(sharpInstance, format).toBuffer({ resolveWithObject: true })
      processedBuffer = result.data
      info = result.info
    }

    const key = `${folder}/${uniqueId}-standard.${extension}`

    return this.uploadBuffer(
      processedBuffer,
      key,
      `image/${format}`,
      info.width,
      info.height,
      encryptionEnabled,
    )
  }

  /**
   * Process thumbnail (320px JPEG)
   * Special handling for SVG (rasterization) and GIF (first frame only for thumbnail)
   */
  private async processThumbnail(
    buffer: Buffer,
    folder: string,
    uniqueId: string,
    thumbnailWidth: number,
    encryptionEnabled: boolean,
    format: string,
  ): Promise<UploadResult & { width: number; height: number }> {
    let sharpInstance: sharp.Sharp

    if (format === 'svg') {
      // SVG: Use sharp's built-in SVG support with density option for rasterization
      // density controls the DPI for SVG rendering (default 72, use higher for quality)
      sharpInstance = sharp(buffer, { density: 150 })
    } else if (format === 'gif') {
      // GIF: Extract first frame for thumbnail (pages[0] = first frame)
      sharpInstance = sharp(buffer, { pages: 1 }).rotate()
    } else {
      // Other raster formats
      sharpInstance = sharp(buffer).rotate()
    }

    const { data, info } = await sharpInstance
      .resize(thumbnailWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true })

    const key = `${folder}/${uniqueId}-thumb.jpg`

    return this.uploadBuffer(data, key, 'image/jpeg', info.width, info.height, encryptionEnabled)
  }

  /**
   * Encode image with format-specific settings
   */
  private encodeImage(sharpInstance: sharp.Sharp, format: string): sharp.Sharp {
    switch (format) {
      case 'jpeg':
        return sharpInstance.jpeg({ quality: 90 })
      case 'png':
        return sharpInstance.png({ compressionLevel: 9 })
      case 'webp':
        return sharpInstance.webp({ quality: 90 })
      case 'gif':
        return sharpInstance.gif()
      default:
        return sharpInstance.jpeg({ quality: 90 })
    }
  }

  /**
   * Encode image with metadata embedding
   */
  private async encodeWithMetadata(
    sharpInstance: sharp.Sharp,
    format: string,
    metadata: any,
  ): Promise<Buffer> {
    let encoded: sharp.Sharp

    switch (format) {
      case 'jpeg':
        encoded = sharpInstance.jpeg({ quality: 90 }).withMetadata(metadata)
        break
      case 'png':
        // Use compressionLevel 6 for balance between speed and size
        encoded = sharpInstance.png({ compressionLevel: 6 }).withMetadata(metadata)
        break
      case 'webp':
        encoded = sharpInstance.webp({ quality: 90 }).withMetadata(metadata)
        break
      default:
        encoded = sharpInstance.jpeg({ quality: 90 }).withMetadata(metadata)
    }

    return encoded.toBuffer()
  }

  /**
   * Upload buffer to MinIO with optional encryption
   */
  private async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
    width: number,
    height: number,
    encryptionEnabled: boolean,
  ): Promise<UploadResult & { width: number; height: number }> {
    let uploadBuffer = buffer
    let encryptionIv: string | undefined
    // Store original contentType for DB - MinIO will use octet-stream for encrypted data
    const originalContentType = contentType

    if (encryptionEnabled) {
      const { encrypted, iv } = await this.encryptionService.encrypt(buffer)
      uploadBuffer = encrypted
      encryptionIv = iv
      contentType = 'application/octet-stream' // Encrypted data in MinIO
    }

    await this.minioClient.putObject(this.bucket, key, uploadBuffer, uploadBuffer.length, {
      'Content-Type': contentType,
    })

    this.logger.log(`Uploaded: ${key} (${width}x${height}, ${(buffer.length / 1024).toFixed(2)}KB)`)

    return {
      url: '', // URL will be set after database record creation
      key,
      bucket: this.bucket,
      size: buffer.length,
      contentType: originalContentType, // Return original contentType for DB storage
      width,
      height,
      encryptionIv,
    }
  }

  /**
   * Delete file from MinIO
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucket, key)
      this.logger.log(`File deleted: ${key}`)
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`, error.stack)
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  }

  /**
   * Get file URL
   */
  getFileUrl(key: string): string {
    return `${this.publicUrl}/${this.bucket}/${key}`
  }

  /**
   * Get object from MinIO as Buffer
   * Used by image proxy API to serve images through the backend
   */
  async getObject(key: string): Promise<Buffer> {
    try {
      const stream = await this.minioClient.getObject(this.bucket, key)
      const chunks: Buffer[] = []

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
      })
    } catch (error) {
      this.logger.error(`Failed to get object: ${error.message}`, error.stack)
      throw new Error(`Failed to get object: ${error.message}`)
    }
  }
}
