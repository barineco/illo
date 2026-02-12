import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { RemoteFetchService } from './remote-fetch.service'
import { FederationCacheService } from './federation-cache.service'
import { RemoteObject } from './remote-fetch.service'

export interface RemoteUserResult {
  id?: string // ローカルDBに保存されている場合のID
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
  isLocal: boolean
  isCached: boolean
}

/**
 * Federation Search Service
 *
 * リモートユーザーの検索、キャッシュ、DB保存を統合的に管理するサービス
 */
@Injectable()
export class FederationSearchService {
  private readonly logger = new Logger(FederationSearchService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly remoteFetch: RemoteFetchService,
    private readonly cache: FederationCacheService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * WebFingerハンドルでリモートユーザーを検索
   *
   * 検索順序:
   * 1. ローカルDB（既にフォロー済みなど）
   * 2. Redis キャッシュ
   * 3. リモートサーバーから取得 → キャッシュとDBに保存
   *
   * @param handle - @username@domain 形式のハンドル
   * @returns リモートユーザー情報
   */
  async searchByHandle(handle: string): Promise<RemoteUserResult | null> {
    try {
      // ハンドルをパース
      const match = handle.match(/^@?([^@]+)@([^@]+)$/)
      if (!match) {
        this.logger.warn(`Invalid handle format: ${handle}`)
        return null
      }

      const [, username, domain] = match

      // ローカルユーザーかチェック
      const localDomain = this.getLocalDomain()
      if (domain === localDomain) {
        return this.searchLocalUser(username)
      }

      // 1. ローカルDBを検索
      const dbUser = await this.prisma.user.findUnique({
        where: {
          username_domain: {
            username,
            domain,
          },
        },
      })

      if (dbUser && this.shouldRefreshCache(dbUser.lastFetchedAt)) {
        // キャッシュが新しい場合はDBから返す
        return this.mapDbUserToResult(dbUser, true)
      }

      // 2. Redisキャッシュを検索
      const cachedUser = await this.cache.getRemoteUserByHandle(username, domain)
      if (cachedUser) {
        this.logger.debug(`Cache hit for: @${username}@${domain}`)
        return {
          ...cachedUser,
          isLocal: false,
          isCached: true,
        }
      }

      // 3. リモートサーバーから取得
      this.logger.log(`Fetching remote user: @${username}@${domain}`)
      const actor = await this.remoteFetch.fetchActorByHandle(handle)

      if (!actor) {
        // 取得失敗の場合、エラーカウントを増やす
        if (dbUser) {
          await this.prisma.user.update({
            where: { id: dbUser.id },
            data: {
              fetchErrorCount: { increment: 1 },
            },
          })
        }
        return null
      }

      // FEDERATION_ONLYモードの場合、illoインスタンスのみ許可
      const instanceSettings = await this.prisma.instanceSettings.findFirst()
      if (instanceSettings?.instanceMode === 'FEDERATION_ONLY') {
        const isOpenIllustboard = this.remoteFetch.isOpenIllustboardActor(actor)
        if (!isOpenIllustboard) {
          this.logger.warn(
            `Rejecting non-illo actor in FEDERATION_ONLY mode: ${actor.id}`,
          )
          return null
        }
      }

      // ActivityPub Actorを変換
      const remoteUser = this.mapActorToRemoteUser(actor)

      // キャッシュに保存
      await this.cache.cacheRemoteUser(actor.id, {
        actorUrl: actor.id,
        username: remoteUser.username,
        domain: remoteUser.domain,
        displayName: remoteUser.displayName,
        avatarUrl: remoteUser.avatarUrl,
        summary: remoteUser.summary,
        inbox: remoteUser.inbox,
        outbox: remoteUser.outbox,
        publicKey: remoteUser.publicKey,
        followersUrl: remoteUser.followersUrl,
        followingUrl: remoteUser.followingUrl,
      })

      // DBに保存または更新
      const savedUser = await this.saveOrUpdateRemoteUser(remoteUser)

      return {
        ...remoteUser,
        id: savedUser.id,
        isLocal: false,
        isCached: true,
      }
    } catch (error) {
      this.logger.error(`Failed to search by handle: ${handle}`, error)
      return null
    }
  }

  /**
   * リモートユーザーをDBに保存または更新
   *
   * @private
   */
  private async saveOrUpdateRemoteUser(user: RemoteUserResult): Promise<any> {
    const existing = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username: user.username,
          domain: user.domain,
        },
      },
    })

    const userData = {
      username: user.username,
      domain: user.domain,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.summary,
      summary: user.summary,
      actorUrl: user.actorUrl,
      inbox: user.inbox,
      outbox: user.outbox,
      publicKey: user.publicKey,
      followersUrl: user.followersUrl,
      followingUrl: user.followingUrl,
      // NOTE: lastFetchedAt is intentionally NOT set here.
      // It should only be set by RemoteArtworkService after fetching artworks.
      // This ensures artworks are fetched when the user profile is first viewed.
      fetchErrorCount: 0,
    }

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: userData,
      })
    } else {
      // 新規リモートユーザー作成
      return this.prisma.user.create({
        data: {
          ...userData,
          // リモートユーザーはメールアドレスやパスワードが不要
          email: `${user.username}@${user.domain}`,
          passwordHash: '', // 空文字列（リモートユーザーはローカル認証しない）
          isActive: true,
          isVerified: true,
        },
      })
    }
  }

  /**
   * ローカルユーザーを検索
   *
   * @private
   */
  private async searchLocalUser(username: string): Promise<RemoteUserResult | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '',
      },
    })

    if (!user) {
      return null
    }

    return this.mapDbUserToResult(user, false)
  }

  /**
   * ActivityPub ActorをRemoteUserResultに変換
   *
   * @private
   */
  private mapActorToRemoteUser(actor: RemoteObject): RemoteUserResult {
    const username = actor.preferredUsername || actor.name || 'unknown'
    const domain = new URL(actor.id).hostname

    // 公開鍵の取得
    let publicKey = ''
    if (actor.publicKey) {
      if (typeof actor.publicKey === 'object' && actor.publicKey.publicKeyPem) {
        publicKey = actor.publicKey.publicKeyPem
      } else if (typeof actor.publicKey === 'string') {
        publicKey = actor.publicKey
      }
    }

    // アイコン画像の取得
    let avatarUrl: string | undefined
    if (actor.icon) {
      if (typeof actor.icon === 'object' && actor.icon.url) {
        avatarUrl = actor.icon.url
      } else if (typeof actor.icon === 'string') {
        avatarUrl = actor.icon
      }
    }

    return {
      actorUrl: actor.id,
      username,
      domain,
      displayName: actor.name || username,
      avatarUrl,
      summary: actor.summary,
      inbox: actor.inbox,
      outbox: actor.outbox,
      publicKey,
      followersUrl: actor.followers,
      followingUrl: actor.following,
      isLocal: false,
      isCached: false,
    }
  }

  /**
   * DBのUserをRemoteUserResultに変換
   *
   * @private
   */
  private mapDbUserToResult(user: any, isCached: boolean): RemoteUserResult {
    const localDomain = this.getLocalDomain()
    const isLocal = user.domain === '' || user.domain === null

    return {
      id: user.id,
      actorUrl: user.actorUrl || `https://${localDomain}/users/${user.username}`,
      username: user.username,
      domain: isLocal ? localDomain : user.domain,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
      summary: user.summary || user.bio,
      inbox: user.inbox || `https://${localDomain}/users/${user.username}/inbox`,
      outbox: user.outbox,
      publicKey: user.publicKey || '',
      followersUrl: user.followersUrl,
      followingUrl: user.followingUrl,
      isLocal,
      isCached,
    }
  }

  /**
   * キャッシュを更新すべきか判定
   *
   * @private
   */
  private shouldRefreshCache(lastFetchedAt: Date | null): boolean {
    if (!lastFetchedAt) {
      return false
    }

    // 1時間以内のキャッシュは有効
    const oneHour = 60 * 60 * 1000
    return Date.now() - lastFetchedAt.getTime() < oneHour
  }

  /**
   * ローカルドメインを取得
   *
   * @private
   */
  private getLocalDomain(): string {
    const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:11104')
    try {
      return new URL(baseUrl).hostname
    } catch {
      return 'localhost'
    }
  }

  /**
   * リモート作品をURLで解決
   *
   * @param artworkUrl - 作品のURL (例: https://remote.example/artworks/abc123)
   * @returns 解決された作品情報、またはnull
   */
  async resolveArtworkByUrl(artworkUrl: string): Promise<{
    id?: string
    apObjectId: string
    title: string
    description?: string
    authorUsername: string
    authorDomain: string
    images: { url: string; width?: number; height?: number }[]
    isLocal: boolean
  } | null> {
    try {
      // URLからドメインを抽出
      const urlObj = new URL(artworkUrl)
      const domain = urlObj.hostname
      const localDomain = this.getLocalDomain()

      // ローカルの作品の場合
      if (domain === localDomain) {
        // URLから作品IDを抽出
        const artworkIdMatch = artworkUrl.match(/\/artworks\/([a-zA-Z0-9_-]+)/)
        if (!artworkIdMatch) {
          return null
        }
        const artworkId = artworkIdMatch[1]

        const artwork = await this.prisma.artwork.findUnique({
          where: { id: artworkId },
          include: {
            author: true,
            images: { orderBy: { order: 'asc' } },
          },
        })

        if (!artwork || artwork.isDeleted) {
          return null
        }

        return {
          id: artwork.id,
          apObjectId: artwork.apObjectId || `https://${localDomain}/artworks/${artwork.id}`,
          title: artwork.title,
          description: artwork.description,
          authorUsername: artwork.author.username,
          authorDomain: artwork.author.domain || localDomain,
          images: artwork.images.map((img) => ({
            url: img.url,
            width: img.width,
            height: img.height,
          })),
          isLocal: true,
        }
      }

      // リモートの作品の場合、まずDBをチェック
      const existingArtwork = await this.prisma.artwork.findFirst({
        where: {
          OR: [
            { apObjectId: artworkUrl },
            { apObjectId: { contains: urlObj.pathname } },
          ],
        },
        include: {
          author: true,
          images: { orderBy: { order: 'asc' } },
        },
      })

      if (existingArtwork && !existingArtwork.isDeleted) {
        return {
          id: existingArtwork.id,
          apObjectId: existingArtwork.apObjectId || artworkUrl,
          title: existingArtwork.title,
          description: existingArtwork.description,
          authorUsername: existingArtwork.author.username,
          authorDomain: existingArtwork.author.domain || localDomain,
          images: existingArtwork.images.map((img) => ({
            url: img.url,
            width: img.width,
            height: img.height,
          })),
          isLocal: false,
        }
      }

      // ActivityPub経由でリモート作品を取得
      this.logger.log(`Fetching remote artwork: ${artworkUrl}`)
      const remoteObject = await this.remoteFetch.fetchObject(artworkUrl)

      if (!remoteObject) {
        return null
      }

      // ActivityPubオブジェクトタイプを検証
      const validTypes = ['Note', 'Article', 'Image', 'Document', 'Create']
      if (!validTypes.includes(remoteObject.type)) {
        // Create アクティビティの場合、object を使う
        if (remoteObject.type === 'Create' && remoteObject.object) {
          const innerObject = remoteObject.object as any
          if (!validTypes.includes(innerObject.type)) {
            this.logger.warn(`Invalid artwork type: ${innerObject.type}`)
            return null
          }
        } else {
          this.logger.warn(`Invalid artwork type: ${remoteObject.type}`)
          return null
        }
      }

      // 作者情報を取得
      const attributedTo = remoteObject.attributedTo as string
      if (!attributedTo) {
        this.logger.warn('Artwork missing attributedTo')
        return null
      }

      // 作者のActorを取得してDBに保存
      const author = await this.remoteFetch.fetchActor(attributedTo)
      if (!author) {
        this.logger.warn(`Failed to fetch author: ${attributedTo}`)
        return null
      }

      const authorUsername = author.preferredUsername || author.name || 'unknown'
      const authorDomain = new URL(author.id).hostname

      // 画像を抽出
      const images: { url: string; width?: number; height?: number }[] = []
      if (remoteObject.attachment) {
        const attachments = Array.isArray(remoteObject.attachment)
          ? remoteObject.attachment
          : [remoteObject.attachment]
        for (const attachment of attachments) {
          if (attachment.type === 'Image' || attachment.type === 'Document') {
            images.push({
              url: attachment.url,
              width: attachment.width,
              height: attachment.height,
            })
          }
        }
      }

      // 画像がない場合、image フィールドをチェック
      if (images.length === 0 && remoteObject.image) {
        const img = remoteObject.image
        if (typeof img === 'string') {
          images.push({ url: img })
        } else if (img.url) {
          images.push({
            url: img.url,
            width: img.width,
            height: img.height,
          })
        }
      }

      return {
        apObjectId: remoteObject.id,
        title: remoteObject.name || remoteObject.summary || 'Untitled',
        description: remoteObject.content,
        authorUsername,
        authorDomain,
        images,
        isLocal: false,
      }
    } catch (error) {
      this.logger.error(`Failed to resolve artwork by URL: ${artworkUrl}`, error)
      return null
    }
  }
}
