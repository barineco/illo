/**
 * Composable for transforming artwork API responses to ArtworkCard format
 *
 * This ensures consistent transformation across all pages that display artwork grids:
 * - index.vue (home page)
 * - search.vue
 * - tags/[name].vue
 * - users/[username].vue
 * - following.vue
 * - collections/[id].vue
 */

export interface ArtworkCardData {
  id: string
  title: string
  thumbnailUrl: string
  likeCount: number
  bookmarkCount: number
  imageCount: number
  images: Array<{ id: string; thumbnailUrl?: string; url?: string }>
  visibility: 'PUBLIC' | 'UNLISTED' | 'FOLLOWERS_ONLY' | 'PRIVATE'
  ageRating: 'ALL_AGES' | 'NSFW' | 'R18' | 'R18G'
  blurred: boolean
  author: {
    username: string
    domain: string | null
    displayName: string
    avatarUrl: string | null
    supporterTier?: 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'
  }
}

export interface ApiArtworkResponse {
  id: string
  title: string
  thumbnailUrl?: string
  images?: Array<{ id: string; thumbnailUrl?: string; url?: string }>
  _count?: {
    likes?: number
    bookmarks?: number
    images?: number
  }
  imageCount?: number
  visibility?: string
  ageRating?: string
  blurred?: boolean
  author: {
    username: string
    domain?: string | null
    displayName?: string
    avatarUrl?: string | null
    supporterTier?: 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'
  }
}

export function useArtworkTransform() {
  /**
   * Transform a single artwork from API response to ArtworkCard format
   */
  const transformArtwork = (artwork: ApiArtworkResponse): ArtworkCardData => {
    return {
      id: artwork.id,
      title: artwork.title,
      thumbnailUrl:
        artwork.thumbnailUrl ||
        artwork.images?.[0]?.thumbnailUrl ||
        artwork.images?.[0]?.url ||
        '',
      likeCount: artwork._count?.likes || 0,
      bookmarkCount: artwork._count?.bookmarks || 0,
      imageCount:
        artwork.imageCount ||
        artwork._count?.images ||
        artwork.images?.length ||
        1,
      images: artwork.images || [],
      visibility: (artwork.visibility as ArtworkCardData['visibility']) || 'PUBLIC',
      ageRating: (artwork.ageRating as ArtworkCardData['ageRating']) || 'ALL_AGES',
      blurred: artwork.blurred || false,
      author: {
        username: artwork.author.username,
        domain: artwork.author.domain || null,
        displayName: artwork.author.displayName || artwork.author.username,
        avatarUrl: artwork.author.avatarUrl || null,
        supporterTier: artwork.author.supporterTier,
      },
    }
  }

  /**
   * Transform an array of artworks from API response to ArtworkCard format
   */
  const transformArtworks = (artworks: ApiArtworkResponse[]): ArtworkCardData[] => {
    return artworks.map(transformArtwork)
  }

  return {
    transformArtwork,
    transformArtworks,
  }
}
