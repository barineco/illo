import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpSignatureService } from './http-signature.service'

export interface FetchOptions {
  /**
   * HTTP署名を使用するか（デフォルト: true）
   */
  useSignature?: boolean

  /**
   * 署名に使用する鍵ID（ActivityPub Actor URL）
   */
  keyId?: string

  /**
   * 署名に使用する秘密鍵（PEM形式）
   */
  privateKey?: string

  /**
   * タイムアウト（ミリ秒、デフォルト: 10000）
   */
  timeout?: number

  /**
   * User-Agent
   */
  userAgent?: string
}

export interface RemoteObject {
  '@context'?: string | string[]
  id: string
  type: string
  [key: string]: any
}

/**
 * Remote Fetch Service
 *
 * HTTP署名を使用してリモートサーバーからActivityPubオブジェクトを取得するサービス
 */
@Injectable()
export class RemoteFetchService {
  private readonly logger = new Logger(RemoteFetchService.name)
  private readonly defaultUserAgent: string

  constructor(
    private readonly httpSignatureService: HttpSignatureService,
    private readonly configService: ConfigService,
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL', '')
    let domain = 'localhost'

    if (baseUrl) {
      try {
        domain = new URL(baseUrl).hostname
      } catch (error) {
        this.logger.warn(`Invalid BASE_URL: "${baseUrl}", using default domain`)
      }
    } else {
      this.logger.warn('BASE_URL is not set, using default domain')
    }

    this.defaultUserAgent = `open-illustboard/1.0 (${domain})`
  }

  /**
   * リモートオブジェクトをGETで取得
   *
   * @param url - 取得するオブジェクトのURL
   * @param options - 取得オプション
   * @returns ActivityPubオブジェクト
   */
  async fetchObject(
    url: string,
    options: FetchOptions = {},
  ): Promise<RemoteObject | null> {
    try {
      const {
        useSignature = true,
        timeout = 10000,
        userAgent = this.defaultUserAgent,
      } = options

      const urlObj = new URL(url)
      const headers: Record<string, string> = {
        Accept: 'application/activity+json, application/ld+json',
        'User-Agent': userAgent,
        Host: urlObj.hostname,
      }

      // HTTP署名を追加
      if (useSignature && options.keyId && options.privateKey) {
        const signatureHeaders = await this.httpSignatureService.signRequest({
          keyId: options.keyId,
          privateKeyPem: options.privateKey,
          method: 'GET',
          path: urlObj.pathname + urlObj.search,
          headers,
        })

        headers.Signature = signatureHeaders.signature
        headers.Date = signatureHeaders.date
      }

      // リクエスト実行
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        // For development environments (.orb.local), disable SSL verification
        const isDevelopment = urlObj.hostname.endsWith('.orb.local') || urlObj.hostname === 'localhost'

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
          // @ts-ignore - Node.js fetch agent option
          ...(isDevelopment && { agent: new (await import('https')).Agent({ rejectUnauthorized: false }) })
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          this.logger.warn(
            `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
          )
          return null
        }

        const contentType = response.headers.get('content-type') || ''
        if (
          !contentType.includes('application/activity+json') &&
          !contentType.includes('application/ld+json') &&
          !contentType.includes('application/json')
        ) {
          this.logger.warn(
            `Invalid content-type for ActivityPub object: ${contentType}`,
          )
          return null
        }

        const data = await response.json()
        return data as RemoteObject
      } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          this.logger.warn(`Fetch timeout: ${url}`)
        } else {
          this.logger.error(`Fetch error: ${url}`, error)
        }
        return null
      }
    } catch (error) {
      this.logger.error(`Invalid URL: ${url}`, error)
      return null
    }
  }

  /**
   * リモートアクター（ユーザー）を取得
   *
   * @param actorUrl - アクターのURL
   * @param options - 取得オプション
   * @returns ActivityPub Actor
   */
  async fetchActor(
    actorUrl: string,
    options: FetchOptions = {},
  ): Promise<RemoteObject | null> {
    const actor = await this.fetchObject(actorUrl, options)

    if (!actor) {
      return null
    }

    // Actorタイプを検証
    const validActorTypes = ['Person', 'Service', 'Application', 'Group', 'Organization']
    if (!validActorTypes.includes(actor.type)) {
      this.logger.warn(
        `Invalid actor type: ${actor.type} (expected Person, Service, etc.)`,
      )
      return null
    }

    // 必須フィールドを検証
    if (!actor.inbox || !actor.preferredUsername) {
      this.logger.warn('Actor missing required fields (inbox, preferredUsername)')
      return null
    }

    return actor
  }

  /**
   * WebFinger経由でアクターURLを解決
   *
   * @param handle - WebFingerハンドル（例: @username@domain.com）
   * @param options - 取得オプション
   * @returns アクターURL
   */
  async resolveWebFinger(
    handle: string,
    options: FetchOptions = {},
  ): Promise<string | null> {
    try {
      // @username@domainからusernameとdomainを抽出
      const match = handle.match(/^@?([^@]+)@([^@]+)$/)
      if (!match) {
        this.logger.warn(`Invalid WebFinger handle: ${handle}`)
        return null
      }

      const [, username, domain] = match
      const webfingerUrl = `https://${domain}/.well-known/webfinger?resource=acct:${username}@${domain}`

      const {
        timeout = 10000,
        userAgent = this.defaultUserAgent,
      } = options

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        // For development environments (.orb.local), disable SSL verification
        const isDevelopment = domain.endsWith('.orb.local') || domain === 'localhost'

        const response = await fetch(webfingerUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/jrd+json',
            'User-Agent': userAgent,
          },
          signal: controller.signal,
          // @ts-ignore - Node.js fetch agent option
          ...(isDevelopment && { agent: new (await import('https')).Agent({ rejectUnauthorized: false }) })
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          this.logger.warn(
            `WebFinger request failed: ${response.status} ${response.statusText}`,
          )
          return null
        }

        const data = await response.json()

        // "self" リンクを探す
        const selfLink = data.links?.find(
          (link: any) =>
            link.rel === 'self' &&
            (link.type === 'application/activity+json' ||
              link.type === 'application/ld+json'),
        )

        if (!selfLink?.href) {
          this.logger.warn('WebFinger response missing self link')
          return null
        }

        return selfLink.href
      } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          this.logger.warn(`WebFinger timeout: ${webfingerUrl}`)
        } else {
          this.logger.error(`WebFinger error: ${webfingerUrl}`, error)
        }
        return null
      }
    } catch (error) {
      this.logger.error(`WebFinger resolution failed: ${handle}`, error)
      return null
    }
  }

  /**
   * WebFingerハンドルからアクターを取得
   *
   * @param handle - WebFingerハンドル（例: @username@domain.com）
   * @param options - 取得オプション
   * @returns ActivityPub Actor
   */
  async fetchActorByHandle(
    handle: string,
    options: FetchOptions = {},
  ): Promise<RemoteObject | null> {
    // WebFingerでアクターURLを解決
    const actorUrl = await this.resolveWebFinger(handle, options)
    if (!actorUrl) {
      return null
    }

    // アクターを取得
    return this.fetchActor(actorUrl, options)
  }

  /**
   * アクターがopen-illustboardインスタンスからのものか検証
   *
   * @param actor - ActivityPub Actor
   * @returns open-illustboardインスタンスの場合true
   */
  isOpenIllustboardActor(actor: RemoteObject): boolean {
    // attachment配列をチェック
    if (Array.isArray(actor.attachment)) {
      for (const item of actor.attachment) {
        if (
          item.type === 'PropertyValue' &&
          item.name === 'Software' &&
          item.value === 'open-illustboard'
        ) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Magic bytes から画像のMIMEタイプを検出
   *
   * @param buffer - 画像バイナリ
   * @returns MIMEタイプ または null
   */
  private detectImageMimeType(buffer: Buffer): string | null {
    if (buffer.length < 8) {
      return null
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg'
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png'
    }

    // GIF: 47 49 46 38
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    ) {
      return 'image/gif'
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return 'image/webp'
    }

    // BMP: 42 4D
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return 'image/bmp'
    }

    // AVIF: ... 66 74 79 70 61 76 69 66 (ftyp + avif)
    if (buffer.length >= 12) {
      const ftypIndex = buffer.indexOf(Buffer.from([0x66, 0x74, 0x79, 0x70]))
      if (ftypIndex >= 4 && ftypIndex <= 8) {
        const brand = buffer.subarray(ftypIndex + 4, ftypIndex + 8).toString('ascii')
        if (brand === 'avif' || brand === 'avis') {
          return 'image/avif'
        }
        if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') {
          return 'image/heic'
        }
      }
    }

    return null
  }

  /**
   * リモート画像をバイナリとして取得
   *
   * @param url - 画像のURL
   * @param options - 取得オプション
   * @returns 画像バイナリ (Buffer) または null
   */
  async fetchImageBinary(
    url: string,
    options: FetchOptions = {},
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    try {
      const {
        useSignature = true,
        timeout = 30000, // 画像取得は少し長めに
        userAgent = this.defaultUserAgent,
      } = options

      const urlObj = new URL(url)
      const headers: Record<string, string> = {
        Accept: 'image/*',
        'User-Agent': userAgent,
        Host: urlObj.hostname,
      }

      // HTTP署名を追加（open-illustboardインスタンス間の場合）
      if (useSignature && options.keyId && options.privateKey) {
        const signatureHeaders = await this.httpSignatureService.signRequest({
          keyId: options.keyId,
          privateKeyPem: options.privateKey,
          method: 'GET',
          path: urlObj.pathname + urlObj.search,
          headers,
        })

        headers.Signature = signatureHeaders.signature
        headers.Date = signatureHeaders.date
      }

      // リクエスト実行
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        // For development environments (.orb.local), disable SSL verification
        const isDevelopment = urlObj.hostname.endsWith('.orb.local') || urlObj.hostname === 'localhost'

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
          // @ts-ignore - Node.js fetch agent option
          ...(isDevelopment && { agent: new (await import('https')).Agent({ rejectUnauthorized: false }) })
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          this.logger.warn(
            `Failed to fetch image ${url}: ${response.status} ${response.statusText}`,
          )
          return null
        }

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // サイズ制限チェック (50MB)
        const maxSize = 50 * 1024 * 1024
        if (buffer.length > maxSize) {
          this.logger.warn(`Image too large: ${buffer.length} bytes (max: ${maxSize})`)
          return null
        }

        // Content-Typeチェック
        const contentType = response.headers.get('content-type') || ''
        let mimeType = contentType.split(';')[0].trim()

        // application/octet-stream の場合（暗号化画像など）、magic bytes で判定
        if (!mimeType.startsWith('image/')) {
          const detectedMime = this.detectImageMimeType(buffer)
          if (detectedMime) {
            this.logger.debug(`Detected image type from magic bytes: ${detectedMime}`)
            mimeType = detectedMime
          } else {
            this.logger.warn(
              `Invalid content-type for image: ${contentType}, and could not detect image from magic bytes`,
            )
            return null
          }
        }

        return {
          buffer,
          mimeType,
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          this.logger.warn(`Image fetch timeout: ${url}`)
        } else {
          this.logger.error(`Image fetch error: ${url}`, error)
        }
        return null
      }
    } catch (error) {
      this.logger.error(`Invalid image URL: ${url}`, error)
      return null
    }
  }
}
