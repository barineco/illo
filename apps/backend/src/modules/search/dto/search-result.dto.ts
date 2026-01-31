import { SearchPatternType } from '../services/search-pattern.service'

export interface UserSearchResultItem {
  id: string
  username: string
  domain: string | null
  displayName: string | null
  avatarUrl: string | null
  isLocal: boolean
  handle: string // @username@domain or @username
}

export interface UserSearchResult {
  users: UserSearchResultItem[]
  total: number
}

export interface ArtworkSearchResultItem {
  id: string
  title: string
  thumbnailUrl: string
  author: {
    id: string
    username: string
    displayName: string | null
  }
}

export interface ArtworkSearchResult {
  artworks: ArtworkSearchResultItem[]
  total: number
}

export interface RemoteOption {
  type: 'remote_user' | 'remote_artwork' | 'remote_domain'
  handle?: string
  url?: string
  domain?: string
  label: string
}

export interface UnifiedSearchResult {
  pattern: {
    type: SearchPatternType
    query: string
  }
  users?: UserSearchResult
  artworks?: ArtworkSearchResult
  remoteOption?: RemoteOption
}
