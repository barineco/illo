// Enums (matches Prisma schema)
export enum ArtworkType {
  ILLUSTRATION = 'ILLUSTRATION',
  MANGA = 'MANGA',
}

export enum AgeRating {
  ALL_AGES = 'ALL_AGES',
  R18 = 'R18',
  R18G = 'R18G',
}

// Base Artwork entity (matches Prisma schema)
export interface Artwork {
  id: string
  title: string
  description: string | null
  type: ArtworkType
  ageRating: AgeRating
  authorId: string
  viewCount: number
  likeCount: number
  bookmarkCount: number
  commentCount: number
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
}

// Artwork image (matches Prisma schema)
export interface ArtworkImage {
  id: string
  artworkId: string
  url: string
  thumbnailUrl: string
  width: number
  height: number
  order: number
  storageKey: string
  fileSize: number
  mimeType: string
  createdAt: Date
}

// Tag entity
export interface Tag {
  id: string
  name: string
  artworkCount: number
  createdAt: Date
  updatedAt: Date
}

// Artwork with relations for API responses
export interface ArtworkWithDetails extends Artwork {
  images: ArtworkImage[]
  tags: Tag[]
  author: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
  isLiked?: boolean
  isBookmarked?: boolean
}

// DTOs for API
export interface CreateArtworkDto {
  title: string
  description?: string
  type: ArtworkType
  ageRating: AgeRating
  tags: string[]
  // Note: images will be handled as multipart/form-data files
}

export interface UpdateArtworkDto {
  title?: string
  description?: string
  ageRating?: AgeRating
  tags?: string[]
}

// Pagination response
export interface PaginatedArtworks {
  artworks: ArtworkWithDetails[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
