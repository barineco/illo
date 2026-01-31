import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

export interface CachedRemoteUser {
  actorUrl: string
  username: string
  domain: string
  displayName: string
  avatarUrl?: string
  summary?: string
  inbox: string
  outbox?: string
  publicKey: string
  followersUrl?: string
  followingUrl?: string
  cachedAt: number
}

export interface CacheOptions {
  /**
   * キャッシュTTL（秒、デフォルト: 3600 = 1時間）
   */
  ttl?: number
}

/**
 * Federation Cache Service
 *
 * Redisを使用してリモートユーザー情報やActivityPubオブジェクトをキャッシュするサービス
 */
@Injectable()
export class FederationCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FederationCacheService.name)
  private redis: Redis | null = null
  private readonly enabled: boolean
  private readonly cacheEnabled: boolean
  private readonly defaultTtl: number

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('REDIS_HOST') !== undefined
    // Allow cache to be disabled via environment variable
    this.cacheEnabled = this.configService.get<string>('FEDERATION_CACHE_ENABLED', 'true') === 'true'
    // TTL from environment variable (default: 3600 seconds = 1 hour)
    this.defaultTtl = this.configService.get<number>('FEDERATION_CACHE_TTL', 3600)

    this.logger.log(`Federation cache: enabled=${this.cacheEnabled}, TTL=${this.defaultTtl}s`)
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Redis not configured, cache disabled')
      return
    }

    try {
      const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost')
      const redisPort = this.configService.get<number>('REDIS_PORT', 6379)

      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries')
            return null
          }
          return Math.min(times * 100, 2000)
        },
      })

      this.redis.on('error', (error) => {
        this.logger.error('Redis error:', error)
      })

      this.redis.on('connect', () => {
        this.logger.log('Redis connected')
      })
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error)
      this.redis = null
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit()
    }
  }

  /**
   * リモートユーザーをキャッシュに保存
   *
   * @param actorUrl - アクターURL
   * @param user - キャッシュするユーザー情報
   * @param options - キャッシュオプション
   */
  async cacheRemoteUser(
    actorUrl: string,
    user: Omit<CachedRemoteUser, 'cachedAt'>,
    options: CacheOptions = {},
  ): Promise<void> {
    if (!this.redis || !this.cacheEnabled) {
      return
    }

    try {
      const ttl = options.ttl || this.defaultTtl
      const cacheKey = this.getActorCacheKey(actorUrl)
      const handleCacheKey = this.getHandleCacheKey(user.username, user.domain)

      const cachedUser: CachedRemoteUser = {
        ...user,
        cachedAt: Date.now(),
      }

      // アクターURLでキャッシュ
      await this.redis.setex(cacheKey, ttl, JSON.stringify(cachedUser))

      // ハンドル（@username@domain）でもキャッシュ（逆引き用）
      await this.redis.setex(handleCacheKey, ttl, actorUrl)

      this.logger.debug(`Cached remote user: ${actorUrl}`)
    } catch (error) {
      this.logger.error(`Failed to cache remote user: ${actorUrl}`, error)
    }
  }

  /**
   * キャッシュからリモートユーザーを取得
   *
   * @param actorUrl - アクターURL
   * @returns キャッシュされたユーザー情報（存在しない場合はnull）
   */
  async getRemoteUser(actorUrl: string): Promise<CachedRemoteUser | null> {
    if (!this.redis || !this.cacheEnabled) {
      return null
    }

    try {
      const cacheKey = this.getActorCacheKey(actorUrl)
      const cached = await this.redis.get(cacheKey)

      if (!cached) {
        return null
      }

      const user = JSON.parse(cached) as CachedRemoteUser

      // キャッシュが古い場合はnullを返す（再取得を促す）
      const maxAge = this.defaultTtl * 1000 // ミリ秒に変換
      if (Date.now() - user.cachedAt > maxAge) {
        this.logger.debug(`Cache expired for: ${actorUrl}`)
        await this.redis.del(cacheKey)
        return null
      }

      this.logger.debug(`Cache hit for: ${actorUrl}`)
      return user
    } catch (error) {
      this.logger.error(`Failed to get cached user: ${actorUrl}`, error)
      return null
    }
  }

  /**
   * ハンドルからリモートユーザーを取得
   *
   * @param username - ユーザー名
   * @param domain - ドメイン
   * @returns キャッシュされたユーザー情報（存在しない場合はnull）
   */
  async getRemoteUserByHandle(
    username: string,
    domain: string,
  ): Promise<CachedRemoteUser | null> {
    if (!this.redis || !this.cacheEnabled) {
      return null
    }

    try {
      const handleCacheKey = this.getHandleCacheKey(username, domain)
      const actorUrl = await this.redis.get(handleCacheKey)

      if (!actorUrl) {
        return null
      }

      return this.getRemoteUser(actorUrl)
    } catch (error) {
      this.logger.error(
        `Failed to get cached user by handle: @${username}@${domain}`,
        error,
      )
      return null
    }
  }

  /**
   * 汎用オブジェクトをキャッシュ
   *
   * @param key - キャッシュキー
   * @param data - キャッシュするデータ
   * @param options - キャッシュオプション
   */
  async cacheObject(
    key: string,
    data: any,
    options: CacheOptions = {},
  ): Promise<void> {
    if (!this.redis || !this.cacheEnabled) {
      return
    }

    try {
      const ttl = options.ttl || this.defaultTtl
      const cacheKey = this.getObjectCacheKey(key)

      await this.redis.setex(cacheKey, ttl, JSON.stringify(data))

      this.logger.debug(`Cached object: ${key}`)
    } catch (error) {
      this.logger.error(`Failed to cache object: ${key}`, error)
    }
  }

  /**
   * キャッシュからオブジェクトを取得
   *
   * @param key - キャッシュキー
   * @returns キャッシュされたデータ（存在しない場合はnull）
   */
  async getObject<T = any>(key: string): Promise<T | null> {
    if (!this.redis || !this.cacheEnabled) {
      return null
    }

    try {
      const cacheKey = this.getObjectCacheKey(key)
      const cached = await this.redis.get(cacheKey)

      if (!cached) {
        return null
      }

      return JSON.parse(cached) as T
    } catch (error) {
      this.logger.error(`Failed to get cached object: ${key}`, error)
      return null
    }
  }

  /**
   * キャッシュから削除
   *
   * @param key - キャッシュキー
   */
  async invalidate(key: string): Promise<void> {
    if (!this.redis) {
      return
    }

    try {
      await this.redis.del(key)
      this.logger.debug(`Invalidated cache: ${key}`)
    } catch (error) {
      this.logger.error(`Failed to invalidate cache: ${key}`, error)
    }
  }

  /**
   * パターンに一致するキャッシュを一括削除
   *
   * @param pattern - キャッシュキーのパターン（例: "federation:actor:*"）
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redis) {
      return
    }

    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
        this.logger.debug(`Invalidated ${keys.length} cache entries matching: ${pattern}`)
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate cache pattern: ${pattern}`, error)
    }
  }

  /**
   * アクターURLからキャッシュキーを生成
   *
   * @private
   */
  private getActorCacheKey(actorUrl: string): string {
    return `federation:actor:${actorUrl}`
  }

  /**
   * ハンドルからキャッシュキーを生成
   *
   * @private
   */
  private getHandleCacheKey(username: string, domain: string): string {
    return `federation:handle:${username}@${domain}`
  }

  /**
   * 汎用オブジェクトのキャッシュキーを生成
   *
   * @private
   */
  private getObjectCacheKey(key: string): string {
    return `federation:object:${key}`
  }
}
