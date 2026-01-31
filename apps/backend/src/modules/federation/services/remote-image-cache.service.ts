import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { StorageService } from '../../storage/storage.service'
import { EncryptionService } from '../../storage/encryption.service'
import { RemoteFetchService, FetchOptions } from './remote-fetch.service'
import { RemoteImageCacheStatus } from '@prisma/client'
import * as sharp from 'sharp'

export interface CacheResult {
  success: boolean
  imageId: string
  cachedAt?: Date
  cacheExpiresAt?: Date
  error?: string
}

export interface CacheStats {
  totalCachedImages: number
  totalCachedSize: number // bytes
  totalCachedAvatars: number
  expiredCount: number
  instanceStats: {
    domain: string
    imageCount: number
    avatarCount: number
    totalSize: number
  }[]
}

export interface CleanupResult {
  deletedImages: number
  deletedAvatars: number
  freedBytes: number
}

/**
 * Remote Image Cache Service
 *
 * リモートインスタンスの画像をローカルにキャッシュするサービス
 * - 作品画像: standard(2048px) + thumbnail(320px)
 * - オリジナル画像はオンデマンドでキャッシュ
 */
@Injectable()
export class RemoteImageCacheService {
  private readonly logger = new Logger(RemoteImageCacheService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly encryptionService: EncryptionService,
    private readonly remoteFetchService: RemoteFetchService,
  ) {}

  /**
   * インスタンス設定を取得
   */
  private async getInstanceSettings() {
    const settings = await this.prisma.instanceSettings.findFirst()
    return settings
  }

  /**
   * リモートURLをfederation URL に変換（open-illustboardインスタンス間の場合）
   * /api/images/:id パターンを /api/federation/images/:id に変換
   *
   * @param url - リモート画像URL
   * @param variant - 画像バリアント（thumbnail/standard/original）
   * @returns 変換後のURL（変換不要の場合は元のURLをそのまま返す）
   */
  private convertToFederationUrl(
    url: string,
    variant: 'thumbnail' | 'standard' | 'original' = 'thumbnail',
  ): string {
    try {
      const urlObj = new URL(url)
      // /api/images/:id パターンを検出
      const imageProxyMatch = urlObj.pathname.match(/^\/api\/images\/([a-zA-Z0-9_-]+)$/)
      if (imageProxyMatch) {
        const imageId = imageProxyMatch[1]
        // federation URL に変換
        // thumbnail: /api/federation/images/:id (default, no suffix)
        // standard:  /api/federation/images/:id/standard
        // original:  /api/federation/images/:id/original
        if (variant === 'thumbnail') {
          urlObj.pathname = `/api/federation/images/${imageId}`
        } else {
          urlObj.pathname = `/api/federation/images/${imageId}/${variant}`
        }
        this.logger.debug(`Converted to federation URL (${variant}): ${url} -> ${urlObj.toString()}`)
        return urlObj.toString()
      }

      // /api/federation/images/:id パターンも処理（既にfederation URLの場合）
      const federationMatch = urlObj.pathname.match(/^\/api\/federation\/images\/([a-zA-Z0-9_-]+)(\/.*)?$/)
      if (federationMatch) {
        const imageId = federationMatch[1]
        if (variant === 'thumbnail') {
          urlObj.pathname = `/api/federation/images/${imageId}`
        } else {
          urlObj.pathname = `/api/federation/images/${imageId}/${variant}`
        }
        return urlObj.toString()
      }

      return url
    } catch {
      return url
    }
  }

  /**
   * HTTP署名用の認証情報を取得
   */
  private async getSignatureCredentials(): Promise<FetchOptions | null> {
    const settings = await this.getInstanceSettings()
    if (!settings?.adminUserId) {
      return null
    }

    const adminUser = await this.prisma.user.findUnique({
      where: { id: settings.adminUserId },
      select: { actorUrl: true, privateKey: true },
    })

    if (!adminUser?.actorUrl || !adminUser?.privateKey) {
      return null
    }

    return {
      keyId: adminUser.actorUrl,
      privateKey: adminUser.privateKey,
      useSignature: true,
    }
  }

  /**
   * TTL延長係数を計算
   */
  private async calculateTtlMultiplier(likeCount: number): Promise<number> {
    const settings = await this.getInstanceSettings()
    if (!settings?.cachePriorityEnabled) {
      return 1.0
    }

    if (likeCount >= settings.cacheLikeTier3) {
      return settings.cacheTtlMultiplierTier3
    } else if (likeCount >= settings.cacheLikeTier2) {
      return settings.cacheTtlMultiplierTier2
    } else if (likeCount >= settings.cacheLikeTier1) {
      return settings.cacheTtlMultiplierTier1
    }

    return 1.0
  }

  /**
   * キャッシュ有効期限を計算
   */
  private async calculateCacheExpiry(likeCount: number = 0): Promise<Date> {
    const settings = await this.getInstanceSettings()
    const baseTtlDays = settings?.remoteImageCacheTtlDays ?? 30
    const multiplier = await this.calculateTtlMultiplier(likeCount)

    const ttlDays = Math.floor(baseTtlDays * multiplier)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + ttlDays)

    return expiresAt
  }

  /**
   * リモート作品画像をキャッシュ
   * standard(2048px) + thumbnail(320px) を生成してMinIOに保存
   */
  async cacheRemoteImage(artworkImageId: string): Promise<CacheResult> {
    const image = await this.prisma.artworkImage.findUnique({
      where: { id: artworkImageId },
      include: {
        artwork: {
          select: { likeCount: true, authorId: true },
        },
      },
    })

    if (!image) {
      return { success: false, imageId: artworkImageId, error: 'Image not found' }
    }

    // リモート画像のみ対象
    if (!image.storageKey.startsWith('remote:')) {
      return { success: false, imageId: artworkImageId, error: 'Not a remote image' }
    }

    // キャッシュ元URLを取得
    const originalRemoteUrl = image.remoteUrl || image.url
    if (!originalRemoteUrl || originalRemoteUrl.startsWith('/api/')) {
      return { success: false, imageId: artworkImageId, error: 'No valid remote URL' }
    }

    // open-illustboardインスタンス間の場合、federation URLに変換（standard版を取得）
    const remoteUrl = this.convertToFederationUrl(originalRemoteUrl, 'standard')
    this.logger.debug(`Fetching remote image: original=${originalRemoteUrl}, converted=${remoteUrl}`)

    // キャッシュ中に設定
    await this.prisma.artworkImage.update({
      where: { id: artworkImageId },
      data: { cacheStatus: RemoteImageCacheStatus.CACHING },
    })

    try {
      // HTTP署名認証情報を取得
      const credentials = await this.getSignatureCredentials()

      // リモート画像をフェッチ（standard版）
      const fetchResult = await this.remoteFetchService.fetchImageBinary(remoteUrl, credentials || {})
      if (!fetchResult) {
        await this.prisma.artworkImage.update({
          where: { id: artworkImageId },
          data: { cacheStatus: RemoteImageCacheStatus.CACHE_FAILED },
        })
        return { success: false, imageId: artworkImageId, error: 'Failed to fetch remote image' }
      }

      const { buffer, mimeType } = fetchResult
      const encryptionEnabled = this.encryptionService.isEnabled()

      // 共通のタイムスタンプを生成（standard と thumbnail で同じタイムスタンプを使用）
      const timestamp = Date.now()

      // 画像をリサイズ (standard: 2048px, thumbnail: 320px)
      const standardResult = await this.processAndUploadImage(
        buffer,
        `cache/artworks/${artworkImageId}`,
        'standard',
        2048,
        90,
        encryptionEnabled,
        timestamp,
      )

      const thumbnailResult = await this.processAndUploadImage(
        buffer,
        `cache/artworks/${artworkImageId}`,
        'thumb',
        320,
        80,
        encryptionEnabled,
        timestamp,
      )

      // キャッシュ有効期限を計算
      const cacheExpiresAt = await this.calculateCacheExpiry(image.artwork?.likeCount || 0)
      const cachedAt = new Date()

      // データベース更新
      await this.prisma.artworkImage.update({
        where: { id: artworkImageId },
        data: {
          cacheStatus: RemoteImageCacheStatus.CACHED,
          cachedAt,
          cacheExpiresAt,
          remoteUrl: remoteUrl,
          // キャッシュ画像のキーに更新
          storageKey: standardResult.key,
          url: standardResult.url,
          thumbnailUrl: thumbnailResult.url,
          fileSize: standardResult.size,
          width: standardResult.width,
          height: standardResult.height,
          mimeType: 'image/jpeg',
          isEncrypted: encryptionEnabled,
          encryptionIv: standardResult.encryptionIv,
          thumbnailEncryptionIv: thumbnailResult.encryptionIv,
        },
      })

      this.logger.log(`Cached remote image: ${artworkImageId} (${standardResult.size} bytes)`)

      return {
        success: true,
        imageId: artworkImageId,
        cachedAt,
        cacheExpiresAt,
      }
    } catch (error) {
      this.logger.error(`Failed to cache remote image ${artworkImageId}: ${error.message}`)
      await this.prisma.artworkImage.update({
        where: { id: artworkImageId },
        data: { cacheStatus: RemoteImageCacheStatus.CACHE_FAILED },
      })
      return { success: false, imageId: artworkImageId, error: error.message }
    }
  }

  /**
   * オリジナル画像をオンデマンドでキャッシュ
   */
  async cacheOriginalImage(artworkImageId: string): Promise<CacheResult> {
    const image = await this.prisma.artworkImage.findUnique({
      where: { id: artworkImageId },
      include: {
        artwork: {
          select: { likeCount: true },
        },
      },
    })

    if (!image) {
      return { success: false, imageId: artworkImageId, error: 'Image not found' }
    }

    // 既にオリジナルがキャッシュされている場合
    if (image.originalStorageKey && !image.originalStorageKey.startsWith('remote:')) {
      return { success: true, imageId: artworkImageId }
    }

    const originalRemoteUrl = image.remoteUrl || image.url
    if (!originalRemoteUrl || originalRemoteUrl.startsWith('/api/')) {
      return { success: false, imageId: artworkImageId, error: 'No valid remote URL' }
    }

    // open-illustboardインスタンス間の場合、federation URLに変換（original版を取得）
    const remoteUrl = this.convertToFederationUrl(originalRemoteUrl, 'original')

    try {
      const credentials = await this.getSignatureCredentials()
      const fetchResult = await this.remoteFetchService.fetchImageBinary(remoteUrl, credentials || {})

      if (!fetchResult) {
        return { success: false, imageId: artworkImageId, error: 'Failed to fetch original image' }
      }

      const { buffer } = fetchResult
      const encryptionEnabled = this.encryptionService.isEnabled()

      // オリジナルサイズでアップロード（リサイズなし、メタデータは削除）
      const originalResult = await this.processAndUploadImage(
        buffer,
        `cache/artworks/${artworkImageId}`,
        'original',
        null, // リサイズなし
        95,
        encryptionEnabled,
      )

      await this.prisma.artworkImage.update({
        where: { id: artworkImageId },
        data: {
          originalStorageKey: originalResult.key,
          originalFileSize: originalResult.size,
          originalEncryptionIv: originalResult.encryptionIv,
        },
      })

      this.logger.log(`Cached original image: ${artworkImageId} (${originalResult.size} bytes)`)

      return {
        success: true,
        imageId: artworkImageId,
        cachedAt: new Date(),
      }
    } catch (error) {
      this.logger.error(`Failed to cache original image ${artworkImageId}: ${error.message}`)
      return { success: false, imageId: artworkImageId, error: error.message }
    }
  }

  /**
   * 画像を処理してMinIOにアップロード
   *
   * @param buffer - 画像バッファ
   * @param folder - 保存先フォルダ
   * @param suffix - ファイル名サフィックス（standard, thumb, original）
   * @param maxWidth - 最大幅（nullの場合リサイズなし）
   * @param quality - JPEG品質
   * @param encrypt - 暗号化するか
   * @param timestamp - タイムスタンプ（省略時は現在時刻）
   */
  private async processAndUploadImage(
    buffer: Buffer,
    folder: string,
    suffix: string,
    maxWidth: number | null,
    quality: number,
    encrypt: boolean,
    timestamp?: number,
  ): Promise<{
    url: string
    key: string
    size: number
    width: number
    height: number
    encryptionIv?: string
  }> {
    // 画像処理（EXIF適用・メタデータ削除・リサイズ）
    let pipeline = sharp(buffer).rotate()

    if (maxWidth) {
      pipeline = pipeline.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
    }

    const { data: processedBuffer, info } = await pipeline
      .jpeg({ quality })
      .toBuffer({ resolveWithObject: true })

    const ts = timestamp ?? Date.now()
    const key = `${folder}/${ts}-${suffix}.jpg`

    let encryptionIv: string | undefined
    let uploadBuffer = processedBuffer

    // 暗号化
    if (encrypt) {
      const encrypted = await this.encryptionService.encrypt(processedBuffer)
      uploadBuffer = encrypted.encrypted
      encryptionIv = encrypted.iv
    }

    // MinIOにアップロード
    const minioClient = (this.storageService as any).minioClient
    const bucket = (this.storageService as any).bucket
    const baseUrl = (this.storageService as any).baseUrl

    await minioClient.putObject(
      bucket,
      key,
      uploadBuffer,
      uploadBuffer.length,
      {
        'Content-Type': encrypt ? 'application/octet-stream' : 'image/jpeg',
      },
    )

    // URLを生成（暗号化時はプロキシAPI経由）
    let url: string
    if (encrypt) {
      // プロキシAPI経由のURLは後で設定（imageIdが必要）
      url = `${baseUrl}/api/images/cache/${key}`
    } else {
      const publicUrl = (this.storageService as any).publicUrl
      url = `${publicUrl}/${bucket}/${key}`
    }

    return {
      url,
      key,
      size: uploadBuffer.length,
      width: info.width,
      height: info.height,
      encryptionIv,
    }
  }

  /**
   * キャッシュを削除
   */
  async invalidateCache(artworkImageId: string): Promise<void> {
    const image = await this.prisma.artworkImage.findUnique({
      where: { id: artworkImageId },
    })

    if (!image || image.cacheStatus !== RemoteImageCacheStatus.CACHED) {
      return
    }

    try {
      const minioClient = (this.storageService as any).minioClient
      const bucket = (this.storageService as any).bucket

      // キャッシュファイルを削除
      if (image.storageKey && image.storageKey.startsWith('cache/')) {
        await minioClient.removeObject(bucket, image.storageKey).catch(() => {})
      }
      if (image.originalStorageKey && image.originalStorageKey.startsWith('cache/')) {
        await minioClient.removeObject(bucket, image.originalStorageKey).catch(() => {})
      }

      // データベース更新（リモートURLに戻す）
      await this.prisma.artworkImage.update({
        where: { id: artworkImageId },
        data: {
          cacheStatus: RemoteImageCacheStatus.NOT_CACHED,
          cachedAt: null,
          cacheExpiresAt: null,
          storageKey: `remote:${artworkImageId}`,
          url: image.remoteUrl,
          thumbnailUrl: image.remoteUrl,
          originalStorageKey: null,
          originalFileSize: null,
          isEncrypted: false,
          encryptionIv: null,
          thumbnailEncryptionIv: null,
          originalEncryptionIv: null,
        },
      })

      this.logger.log(`Invalidated cache for image: ${artworkImageId}`)
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for ${artworkImageId}: ${error.message}`)
    }
  }

  /**
   * 期限切れキャッシュを一括削除
   */
  async cleanupExpiredCache(): Promise<CleanupResult> {
    const settings = await this.getInstanceSettings()
    const now = new Date()

    let deletedImages = 0
    let deletedAvatars = 0
    let freedBytes = 0

    // 期限切れの作品画像を取得
    const expiredImages = await this.prisma.artworkImage.findMany({
      where: {
        cacheStatus: RemoteImageCacheStatus.CACHED,
        cacheExpiresAt: { lt: now },
      },
      include: {
        artwork: {
          select: { likeCount: true, viewCount: true },
        },
      },
    })

    for (const image of expiredImages) {
      // 優先度チェック（有効な場合）
      if (settings?.cachePriorityEnabled && image.artwork) {
        const priorityScore = (image.artwork.likeCount * 10) + image.artwork.viewCount
        if (priorityScore >= settings.cachePriorityThreshold) {
          // TTLを延長
          const newExpiresAt = await this.calculateCacheExpiry(image.artwork.likeCount)
          await this.prisma.artworkImage.update({
            where: { id: image.id },
            data: { cacheExpiresAt: newExpiresAt },
          })
          this.logger.log(`Extended cache TTL for popular image: ${image.id} (score: ${priorityScore})`)
          continue
        }
      }

      // キャッシュを削除
      freedBytes += image.fileSize + (image.originalFileSize || 0)
      await this.invalidateCache(image.id)
      deletedImages++
    }

    // 期限切れのアバターキャッシュを取得・削除
    const expiredAvatars = await this.prisma.user.findMany({
      where: {
        avatarCacheStatus: RemoteImageCacheStatus.CACHED,
        avatarCacheExpiresAt: { lt: now },
      },
    })

    for (const user of expiredAvatars) {
      await this.invalidateAvatarCache(user.id)
      deletedAvatars++
    }

    this.logger.log(`Cleanup completed: ${deletedImages} images, ${deletedAvatars} avatars, ${freedBytes} bytes freed`)

    return { deletedImages, deletedAvatars, freedBytes }
  }

  /**
   * アバターキャッシュを削除
   */
  async invalidateAvatarCache(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.avatarCacheStatus !== RemoteImageCacheStatus.CACHED) {
      return
    }

    try {
      const minioClient = (this.storageService as any).minioClient
      const bucket = (this.storageService as any).bucket

      // キャッシュファイルを削除
      if (user.cachedAvatarUrl) {
        const key = user.cachedAvatarUrl.split(`/${bucket}/`)[1]
        if (key && key.startsWith('cache/')) {
          await minioClient.removeObject(bucket, key).catch(() => {})
        }
      }

      // データベース更新
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          avatarCacheStatus: RemoteImageCacheStatus.NOT_CACHED,
          avatarCachedAt: null,
          avatarCacheExpiresAt: null,
          cachedAvatarUrl: null,
        },
      })

      this.logger.log(`Invalidated avatar cache for user: ${userId}`)
    } catch (error) {
      this.logger.error(`Failed to invalidate avatar cache for ${userId}: ${error.message}`)
    }
  }

  /**
   * キャッシュ統計を取得
   */
  async getCacheStats(): Promise<CacheStats> {
    const now = new Date()

    // 作品画像のキャッシュ統計
    const cachedImages = await this.prisma.artworkImage.findMany({
      where: { cacheStatus: RemoteImageCacheStatus.CACHED },
      include: {
        artwork: {
          include: {
            author: {
              select: { domain: true },
            },
          },
        },
      },
    })

    // ユーザーアバターのキャッシュ統計
    const cachedAvatars = await this.prisma.user.findMany({
      where: { avatarCacheStatus: RemoteImageCacheStatus.CACHED },
      select: { domain: true },
    })

    // 期限切れカウント
    const expiredImages = await this.prisma.artworkImage.count({
      where: {
        cacheStatus: RemoteImageCacheStatus.CACHED,
        cacheExpiresAt: { lt: now },
      },
    })

    const expiredAvatars = await this.prisma.user.count({
      where: {
        avatarCacheStatus: RemoteImageCacheStatus.CACHED,
        avatarCacheExpiresAt: { lt: now },
      },
    })

    // インスタンス別統計を集計
    const instanceMap = new Map<string, { imageCount: number; avatarCount: number; totalSize: number }>()

    for (const image of cachedImages) {
      const domain = image.artwork?.author?.domain || 'unknown'
      const stats = instanceMap.get(domain) || { imageCount: 0, avatarCount: 0, totalSize: 0 }
      stats.imageCount++
      stats.totalSize += image.fileSize + (image.originalFileSize || 0)
      instanceMap.set(domain, stats)
    }

    for (const user of cachedAvatars) {
      const domain = user.domain || 'unknown'
      const stats = instanceMap.get(domain) || { imageCount: 0, avatarCount: 0, totalSize: 0 }
      stats.avatarCount++
      instanceMap.set(domain, stats)
    }

    const instanceStats = Array.from(instanceMap.entries())
      .map(([domain, stats]) => ({ domain, ...stats }))
      .sort((a, b) => b.totalSize - a.totalSize)

    const totalCachedSize = cachedImages.reduce(
      (sum, img) => sum + img.fileSize + (img.originalFileSize || 0),
      0,
    )

    return {
      totalCachedImages: cachedImages.length,
      totalCachedSize,
      totalCachedAvatars: cachedAvatars.length,
      expiredCount: expiredImages + expiredAvatars,
      instanceStats,
    }
  }

  /**
   * 特定インスタンスのキャッシュを全削除
   */
  async clearInstanceCache(domain: string): Promise<CleanupResult> {
    let deletedImages = 0
    let deletedAvatars = 0
    let freedBytes = 0

    // 該当インスタンスの作品画像を取得
    const images = await this.prisma.artworkImage.findMany({
      where: {
        cacheStatus: RemoteImageCacheStatus.CACHED,
        artwork: {
          author: { domain },
        },
      },
    })

    for (const image of images) {
      freedBytes += image.fileSize + (image.originalFileSize || 0)
      await this.invalidateCache(image.id)
      deletedImages++
    }

    // 該当インスタンスのユーザーアバターを取得
    const users = await this.prisma.user.findMany({
      where: {
        domain,
        avatarCacheStatus: RemoteImageCacheStatus.CACHED,
      },
    })

    for (const user of users) {
      await this.invalidateAvatarCache(user.id)
      deletedAvatars++
    }

    this.logger.log(`Cleared cache for instance ${domain}: ${deletedImages} images, ${deletedAvatars} avatars`)

    return { deletedImages, deletedAvatars, freedBytes }
  }

  /**
   * リモート画像をオンデマンドでプロキシ（キャッシュせずに即座に返す）
   * ImageProxyController から呼び出される
   *
   * @param imageId - 画像ID
   * @param variant - 画像バリアント（thumbnail/standard/original）
   * @returns 画像バイナリとMIMEタイプ
   */
  async proxyRemoteImage(
    imageId: string,
    variant: 'thumbnail' | 'standard' | 'original' = 'thumbnail',
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const image = await this.prisma.artworkImage.findUnique({
      where: { id: imageId },
    })

    if (!image) {
      this.logger.warn(`Image not found for proxy: ${imageId}`)
      return null
    }

    // リモート画像のみ対象（キャッシュ済みでもremoteUrlがあればプロキシ可能）
    const isRemoteImage = image.storageKey.startsWith('remote:') || !!image.remoteUrl
    if (!isRemoteImage) {
      this.logger.warn(`Not a remote image: ${imageId}`)
      return null
    }

    // リモートURLを取得
    const originalRemoteUrl = image.remoteUrl || image.url
    if (!originalRemoteUrl || originalRemoteUrl.startsWith('/api/images/')) {
      this.logger.warn(`No valid remote URL for image ${imageId}: ${originalRemoteUrl}`)
      return null
    }

    // open-illustboardインスタンス間の場合、federation URLに変換
    // variant によって取得するエンドポイントが異なる:
    // - thumbnail: /api/federation/images/:id (認証不要)
    // - standard:  /api/federation/images/:id/standard (HTTP署名必須)
    // - original:  /api/federation/images/:id/original (HTTP署名必須)
    const remoteUrl = this.convertToFederationUrl(originalRemoteUrl, variant)
    this.logger.debug(`Proxying remote image (${variant}): ${imageId}, url: ${remoteUrl}`)

    try {
      // HTTP署名認証情報を取得
      // thumbnail は認証不要だが、standard/original は認証が必要
      const credentials = variant === 'thumbnail' ? {} : (await this.getSignatureCredentials() || {})

      // リモート画像をフェッチ
      const fetchResult = await this.remoteFetchService.fetchImageBinary(remoteUrl, credentials)
      if (!fetchResult) {
        this.logger.warn(`Failed to fetch remote image: ${remoteUrl}`)
        return null
      }

      return fetchResult
    } catch (error) {
      this.logger.error(`Failed to proxy remote image ${imageId}: ${error.message}`)
      return null
    }
  }

  /**
   * キャッシュジョブをキューに追加
   * ImageProxyController から呼び出される
   *
   * @param imageId - 画像ID
   */
  async queueCacheJob(imageId: string): Promise<void> {
    // 画像情報を取得
    const image = await this.prisma.artworkImage.findUnique({
      where: { id: imageId },
    })

    if (!image) {
      this.logger.warn(`Image not found for cache job: ${imageId}`)
      return
    }

    // リモート画像のみ対象
    if (!image.storageKey.startsWith('remote:')) {
      return
    }

    // 既にキャッシュ中または完了している場合はスキップ
    if (image.cacheStatus === RemoteImageCacheStatus.CACHING || image.cacheStatus === RemoteImageCacheStatus.CACHED) {
      return
    }

    // 直接キャッシュ処理を実行（バックグラウンドで）
    // Note: BullMQ が設定されている場合はキューを使用するが、
    // 簡易的にここでは直接実行する
    this.cacheRemoteImage(imageId).catch((err) => {
      this.logger.error(`Background cache job failed for ${imageId}: ${err.message}`)
    })
  }
}
