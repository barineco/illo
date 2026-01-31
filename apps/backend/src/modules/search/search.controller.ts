import { Controller, Get, Query, Post, Body } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'
import { SearchPatternService, SearchPatternType } from './services/search-pattern.service'
import { UsersService } from '../users/users.service'
import { ArtworksService } from '../artworks/artworks.service'
import { ConfigService } from '@nestjs/config'
import { UnifiedSearchResult, RemoteOption } from './dto/search-result.dto'
import { FederationSearchService } from '../federation/services/federation-search.service'

@Controller('search')
export class SearchController {
  constructor(
    private searchPatternService: SearchPatternService,
    private usersService: UsersService,
    private artworksService: ArtworksService,
    private configService: ConfigService,
    private federationSearchService: FederationSearchService,
  ) {}

  /**
   * Unified search endpoint
   * GET /api/search?q=query&type=all&limit=10
   */
  @Public()
  @Get()
  async search(
    @Query('q') query: string,
    @Query('type') type: 'all' | 'users' | 'artworks' = 'all',
    @Query('limit') limitStr?: string,
  ): Promise<UnifiedSearchResult> {
    const limit = limitStr ? parseInt(limitStr, 10) : 10

    if (!query || query.trim().length === 0) {
      return {
        pattern: {
          type: SearchPatternType.KEYWORD,
          query: '',
        },
        users: { users: [], total: 0 },
        artworks: { artworks: [], total: 0 },
      }
    }

    // パターン検出
    const pattern = this.searchPatternService.detectPattern(query)

    const result: UnifiedSearchResult = {
      pattern: {
        type: pattern.type,
        query: pattern.query,
      },
    }

    // リモートオプションの生成
    if (pattern.metadata && !pattern.metadata.isLocal) {
      result.remoteOption = this.createRemoteOption(pattern)
    }

    // ローカル検索を実行
    if (type === 'all' || type === 'users') {
      // @記号を除去してユーザー検索（@adminの場合はadminで検索）
      const searchQuery =
        pattern.type === SearchPatternType.WEBFINGER && pattern.metadata?.username
          ? pattern.metadata.username
          : query.replace(/^@/, '')

      const userSearchResult = await this.usersService.searchUsers(
        searchQuery,
        limit,
        true,
      )

      // 検索結果を変換
      result.users = {
        users: userSearchResult.users.map((user) => {
          const baseUrl = this.configService.get<string>('BASE_URL', '')
          const localDomain = this.extractDomain(baseUrl)
          return {
            id: user.id,
            username: user.username,
            domain: user.domain,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            isLocal: user.domain === null,
            handle: user.domain
              ? `@${user.username}@${user.domain}`
              : `@${user.username}@${localDomain}`,
          }
        }),
        total: userSearchResult.total,
      }
    }

    if (type === 'all' || type === 'artworks') {
      const artworkSearchResult = await this.artworksService.getArtworks({
        q: query,
        page: 1,
        limit,
        sort: 'latest',
      })

      result.artworks = {
        artworks: artworkSearchResult.artworks.map((artwork) => ({
          id: artwork.id,
          title: artwork.title,
          thumbnailUrl: artwork.images[0]?.thumbnailUrl || '',
          author: {
            id: artwork.author.id,
            username: artwork.author.username,
            displayName: artwork.author.displayName,
          },
        })),
        total: artworkSearchResult.pagination.total,
      }
    }

    return result
  }

  /**
   * リモートオプションを生成
   */
  private createRemoteOption(pattern: any): RemoteOption {
    switch (pattern.type) {
      case SearchPatternType.WEBFINGER:
        return {
          type: 'remote_user',
          handle: `@${pattern.metadata.username}@${pattern.metadata.domain}`,
          label: `@${pattern.metadata.username}@${pattern.metadata.domain}に移動`,
        }

      case SearchPatternType.ARTWORK_URL:
        return {
          type: 'remote_artwork',
          url: pattern.metadata.url,
          domain: pattern.metadata.domain,
          label: `${pattern.metadata.domain}の作品を表示`,
        }

      case SearchPatternType.USER_URL:
        return {
          type: 'remote_user',
          url: pattern.metadata.url,
          domain: pattern.metadata.domain,
          label: `${pattern.metadata.domain}のユーザーを表示`,
        }

      case SearchPatternType.DOMAIN:
        return {
          type: 'remote_domain',
          domain: pattern.metadata.domain,
          label: `${pattern.metadata.domain}を検索`,
        }

      default:
        return null
    }
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return 'localhost'
    }
  }

  /**
   * Resolve remote user endpoint
   * POST /api/search/resolve-user
   *
   * @body handle - WebFinger handle (e.g., @username@domain.com)
   * @returns Resolved remote user information
   */
  @Public()
  @Post('resolve-user')
  async resolveRemoteUser(
    @Body('handle') handle: string,
  ): Promise<{
    success: boolean
    user?: any
    error?: string
  }> {
    try {
      if (!handle || handle.trim().length === 0) {
        return {
          success: false,
          error: 'Handle is required',
        }
      }

      // WebFingerパターンを検証
      const pattern = this.searchPatternService.detectPattern(handle)
      if (pattern.type !== SearchPatternType.WEBFINGER) {
        return {
          success: false,
          error: 'Invalid WebFinger handle format. Expected: @username@domain',
        }
      }

      // リモートユーザーを解決
      const remoteUser = await this.federationSearchService.searchByHandle(handle)

      if (!remoteUser) {
        return {
          success: false,
          error: 'Failed to resolve remote user',
        }
      }

      // レスポンスを整形
      const baseUrl = this.configService.get<string>('BASE_URL', '')
      const localDomain = this.extractDomain(baseUrl)

      return {
        success: true,
        user: {
          id: remoteUser.id,
          username: remoteUser.username,
          domain: remoteUser.domain,
          displayName: remoteUser.displayName,
          avatarUrl: remoteUser.avatarUrl,
          summary: remoteUser.summary,
          isLocal: remoteUser.isLocal,
          handle: remoteUser.isLocal
            ? `@${remoteUser.username}@${localDomain}`
            : `@${remoteUser.username}@${remoteUser.domain}`,
          actorUrl: remoteUser.actorUrl,
        },
      }
    } catch (error) {
      console.error('Failed to resolve remote user:', error)
      return {
        success: false,
        error: 'Internal server error',
      }
    }
  }

  /**
   * Resolve remote artwork by URL
   * POST /api/search/resolve-artwork
   *
   * @body url - Artwork URL (e.g., https://remote.example/artworks/abc123)
   * @returns Resolved remote artwork information
   */
  @Public()
  @Post('resolve-artwork')
  async resolveRemoteArtwork(
    @Body('url') url: string,
  ): Promise<{
    success: boolean
    artwork?: any
    error?: string
  }> {
    try {
      if (!url || url.trim().length === 0) {
        return {
          success: false,
          error: 'URL is required',
        }
      }

      // URLパターンを検証
      const pattern = this.searchPatternService.detectPattern(url)
      if (pattern.type !== SearchPatternType.ARTWORK_URL) {
        return {
          success: false,
          error: 'Invalid artwork URL format',
        }
      }

      // 作品を解決
      const artwork = await this.federationSearchService.resolveArtworkByUrl(url)

      if (!artwork) {
        return {
          success: false,
          error: 'Failed to resolve remote artwork',
        }
      }

      return {
        success: true,
        artwork: {
          id: artwork.id,
          apObjectId: artwork.apObjectId,
          title: artwork.title,
          description: artwork.description,
          author: {
            username: artwork.authorUsername,
            domain: artwork.authorDomain,
            handle: `@${artwork.authorUsername}@${artwork.authorDomain}`,
          },
          images: artwork.images,
          isLocal: artwork.isLocal,
        },
      }
    } catch (error) {
      console.error('Failed to resolve remote artwork:', error)
      return {
        success: false,
        error: 'Internal server error',
      }
    }
  }
}
