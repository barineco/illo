import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export enum SearchPatternType {
  WEBFINGER = 'webfinger', // @username@domain or @username
  ARTWORK_URL = 'artwork_url', // https://domain/artworks/123
  USER_URL = 'user_url', // https://domain/users/username
  DOMAIN = 'domain', // example.com or https://example.com
  KEYWORD = 'keyword', // フォールバック: 通常のテキスト検索
}

export interface SearchPattern {
  type: SearchPatternType
  query: string
  metadata?: {
    username?: string
    domain?: string
    isLocal?: boolean
    artworkId?: string
    url?: string
  }
}

@Injectable()
export class SearchPatternService {
  private readonly WEBFINGER_REGEX =
    /^@?([a-zA-Z0-9_]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/
  private readonly WEBFINGER_LOCAL_REGEX = /^@([a-zA-Z0-9_]+)$/
  private readonly ARTWORK_URL_REGEX =
    /^https?:\/\/([^\/]+)\/artworks\/([a-zA-Z0-9_-]+)/
  private readonly USER_URL_REGEX =
    /^https?:\/\/([^\/]+)\/(users\/|@)([a-zA-Z0-9_]+)/
  private readonly DOMAIN_REGEX =
    /^(https?:\/\/)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/)?$/

  constructor(private configService: ConfigService) {}

  /**
   * 検索クエリを解析してパターンを検出
   */
  detectPattern(query: string): SearchPattern {
    const trimmedQuery = query.trim()

    // WebFinger handle (@username@domain)
    const webfingerMatch = trimmedQuery.match(this.WEBFINGER_REGEX)
    if (webfingerMatch) {
      const [, username, domain] = webfingerMatch
      const isLocal = this.isLocalDomain(domain)

      return {
        type: SearchPatternType.WEBFINGER,
        query: trimmedQuery,
        metadata: {
          username,
          domain,
          isLocal,
        },
      }
    }

    // Local WebFinger handle (@username)
    const localWebfingerMatch = trimmedQuery.match(this.WEBFINGER_LOCAL_REGEX)
    if (localWebfingerMatch) {
      const [, username] = localWebfingerMatch
      const localDomain = this.getLocalDomain()

      return {
        type: SearchPatternType.WEBFINGER,
        query: trimmedQuery,
        metadata: {
          username,
          domain: localDomain,
          isLocal: true,
        },
      }
    }

    // Artwork URL
    const artworkUrlMatch = trimmedQuery.match(this.ARTWORK_URL_REGEX)
    if (artworkUrlMatch) {
      const [url, domain, artworkId] = artworkUrlMatch
      const isLocal = this.isLocalDomain(domain)

      return {
        type: SearchPatternType.ARTWORK_URL,
        query: trimmedQuery,
        metadata: {
          domain,
          artworkId,
          isLocal,
          url,
        },
      }
    }

    // User URL
    const userUrlMatch = trimmedQuery.match(this.USER_URL_REGEX)
    if (userUrlMatch) {
      const [url, domain, , username] = userUrlMatch
      const isLocal = this.isLocalDomain(domain)

      return {
        type: SearchPatternType.USER_URL,
        query: trimmedQuery,
        metadata: {
          domain,
          username,
          isLocal,
          url,
        },
      }
    }

    // Domain
    const domainMatch = trimmedQuery.match(this.DOMAIN_REGEX)
    if (domainMatch) {
      const [, , domain] = domainMatch
      const isLocal = this.isLocalDomain(domain)

      return {
        type: SearchPatternType.DOMAIN,
        query: trimmedQuery,
        metadata: {
          domain,
          isLocal,
        },
      }
    }

    // Keyword (フォールバック)
    return {
      type: SearchPatternType.KEYWORD,
      query: trimmedQuery,
    }
  }

  /**
   * ドメインがローカルインスタンスかどうかを判定
   */
  private isLocalDomain(domain: string): boolean {
    const baseUrl = this.configService.get<string>('BASE_URL', '')
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', '')

    // BASE_URLとFRONTEND_URLからドメイン部分を抽出
    const extractDomain = (url: string): string => {
      try {
        const urlObj = new URL(url)
        return urlObj.hostname
      } catch {
        return url
      }
    }

    const localDomains = [
      extractDomain(baseUrl),
      extractDomain(frontendUrl),
      'localhost',
    ]

    return localDomains.some((localDomain) => domain === localDomain)
  }

  /**
   * ローカルインスタンスのドメインを取得
   */
  private getLocalDomain(): string {
    const baseUrl = this.configService.get<string>('BASE_URL', '')
    try {
      const urlObj = new URL(baseUrl)
      return urlObj.hostname
    } catch {
      return 'localhost'
    }
  }

  /**
   * WebFingerハンドルをパース
   */
  parseHandle(handle: string): { username: string; domain: string } | null {
    const pattern = this.detectPattern(handle)
    if (pattern.type === SearchPatternType.WEBFINGER && pattern.metadata) {
      return {
        username: pattern.metadata.username!,
        domain: pattern.metadata.domain!,
      }
    }
    return null
  }
}
