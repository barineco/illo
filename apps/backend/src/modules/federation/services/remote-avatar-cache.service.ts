import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { StorageService } from '../../storage/storage.service'
import { RemoteFetchService, FetchOptions } from './remote-fetch.service'
import { RemoteImageCacheStatus } from '@prisma/client'
import * as sharp from 'sharp'

export interface AvatarCacheResult {
  success: boolean
  userId: string
  cachedAt?: Date
  cacheExpiresAt?: Date
  cachedAvatarUrl?: string
  error?: string
}

/**
 * Remote Avatar Cache Service
 *
 * リモートユーザーのアバターをローカルにキャッシュするサービス
 * - アバターは暗号化しない（ActivityPub互換性のため）
 * - 400pxにリサイズ
 */
@Injectable()
export class RemoteAvatarCacheService {
  private readonly logger = new Logger(RemoteAvatarCacheService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly remoteFetchService: RemoteFetchService,
  ) {}

  /**
   * インスタンス設定を取得
   */
  private async getInstanceSettings() {
    return await this.prisma.instanceSettings.findFirst()
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
   * キャッシュ有効期限を計算
   */
  private async calculateCacheExpiry(): Promise<Date> {
    const settings = await this.getInstanceSettings()
    const ttlDays = settings?.remoteImageCacheTtlDays ?? 30

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + ttlDays)

    return expiresAt
  }

  /**
   * リモートユーザーのアバターをキャッシュ
   */
  async cacheAvatar(userId: string): Promise<AvatarCacheResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return { success: false, userId, error: 'User not found' }
    }

    // ローカルユーザーは対象外
    if (!user.domain) {
      return { success: false, userId, error: 'Not a remote user' }
    }

    // アバターURLがない場合
    if (!user.avatarUrl) {
      return { success: false, userId, error: 'No avatar URL' }
    }

    // 既にキャッシュ済みで有効期限内の場合はスキップ
    if (
      user.avatarCacheStatus === RemoteImageCacheStatus.CACHED &&
      user.avatarCacheExpiresAt &&
      user.avatarCacheExpiresAt > new Date()
    ) {
      return {
        success: true,
        userId,
        cachedAt: user.avatarCachedAt || undefined,
        cacheExpiresAt: user.avatarCacheExpiresAt,
        cachedAvatarUrl: user.cachedAvatarUrl || undefined,
      }
    }

    // キャッシュ中に設定
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarCacheStatus: RemoteImageCacheStatus.CACHING },
    })

    try {
      // HTTP署名認証情報を取得
      const credentials = await this.getSignatureCredentials()

      // リモートアバターをフェッチ
      const fetchResult = await this.remoteFetchService.fetchImageBinary(
        user.avatarUrl,
        credentials || {},
      )

      if (!fetchResult) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { avatarCacheStatus: RemoteImageCacheStatus.CACHE_FAILED },
        })
        return { success: false, userId, error: 'Failed to fetch remote avatar' }
      }

      const { buffer } = fetchResult

      // 画像をリサイズ（400px、メタデータ削除）
      const { data: processedBuffer, info } = await sharp(buffer)
        .rotate() // EXIF適用・削除
        .resize(400, null, {
          withoutEnlargement: true,
          fit: 'inside',
        })
        .jpeg({ quality: 85 })
        .toBuffer({ resolveWithObject: true })

      // MinIOにアップロード（暗号化なし - ActivityPub互換性）
      const timestamp = Date.now()
      const key = `cache/avatars/${userId}/${timestamp}.jpg`

      const minioClient = (this.storageService as any).minioClient
      const bucket = (this.storageService as any).bucket
      const publicUrl = (this.storageService as any).publicUrl

      await minioClient.putObject(
        bucket,
        key,
        processedBuffer,
        processedBuffer.length,
        {
          'Content-Type': 'image/jpeg',
        },
      )

      const cachedAvatarUrl = `${publicUrl}/${bucket}/${key}`
      const cachedAt = new Date()
      const cacheExpiresAt = await this.calculateCacheExpiry()

      // データベース更新
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          avatarCacheStatus: RemoteImageCacheStatus.CACHED,
          avatarCachedAt: cachedAt,
          avatarCacheExpiresAt: cacheExpiresAt,
          cachedAvatarUrl,
        },
      })

      this.logger.log(
        `Cached avatar for user ${userId} (${info.width}x${info.height}, ${processedBuffer.length} bytes)`,
      )

      return {
        success: true,
        userId,
        cachedAt,
        cacheExpiresAt,
        cachedAvatarUrl,
      }
    } catch (error) {
      this.logger.error(`Failed to cache avatar for ${userId}: ${error.message}`)
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatarCacheStatus: RemoteImageCacheStatus.CACHE_FAILED },
      })
      return { success: false, userId, error: error.message }
    }
  }

  /**
   * アバターキャッシュを削除
   */
  async invalidateCache(userId: string): Promise<void> {
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
   * リモートユーザーのアバターURLを取得（キャッシュ優先）
   */
  async getAvatarUrl(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarUrl: true,
        cachedAvatarUrl: true,
        avatarCacheStatus: true,
        avatarCacheExpiresAt: true,
      },
    })

    if (!user) {
      return null
    }

    // キャッシュが有効な場合はキャッシュURLを返す
    if (
      user.avatarCacheStatus === RemoteImageCacheStatus.CACHED &&
      user.cachedAvatarUrl &&
      user.avatarCacheExpiresAt &&
      user.avatarCacheExpiresAt > new Date()
    ) {
      return user.cachedAvatarUrl
    }

    // それ以外はオリジナルURLを返す
    return user.avatarUrl
  }

  /**
   * 全リモートユーザーのアバターをキャッシュ（バッチ処理）
   */
  async cacheAllRemoteAvatars(options?: { limit?: number }): Promise<{
    processed: number
    success: number
    failed: number
  }> {
    const limit = options?.limit ?? 100

    // キャッシュされていないリモートユーザーを取得
    const users = await this.prisma.user.findMany({
      where: {
        domain: { not: '' },
        avatarUrl: { not: null },
        OR: [
          { avatarCacheStatus: null },
          { avatarCacheStatus: RemoteImageCacheStatus.NOT_CACHED },
          {
            avatarCacheStatus: RemoteImageCacheStatus.CACHED,
            avatarCacheExpiresAt: { lt: new Date() },
          },
        ],
      },
      take: limit,
      select: { id: true },
    })

    let success = 0
    let failed = 0

    for (const user of users) {
      const result = await this.cacheAvatar(user.id)
      if (result.success) {
        success++
      } else {
        failed++
      }
    }

    this.logger.log(`Batch avatar cache: ${success} success, ${failed} failed`)

    return { processed: users.length, success, failed }
  }
}
