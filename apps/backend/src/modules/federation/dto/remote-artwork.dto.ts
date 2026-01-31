/**
 * Remote Artwork DTOs
 *
 * Data structures for fetching and storing remote artworks via ActivityPub
 */

/**
 * Image data extracted from ActivityPub attachment
 */
export interface RemoteImageData {
  url: string
  mediaType?: string
  width?: number
  height?: number
}

/**
 * Artwork data parsed from ActivityPub Create activity
 */
export interface RemoteArtworkData {
  /** ActivityPub Object ID (URL) */
  apObjectId: string
  /** Artwork title (from name or summary) */
  title: string
  /** Artwork description (from content) */
  description?: string
  /** Image attachments */
  images: RemoteImageData[]
  /** Publication date */
  publishedAt: Date
  /** Actor URL of the author */
  authorActorUrl: string
  /** Hashtags */
  tags?: string[]
  /** Sensitive content flag */
  sensitive?: boolean
  /** Content Warning / Summary text (used for age rating detection) */
  summary?: string
}

/**
 * Result of fetching outbox
 */
export interface OutboxFetchResult {
  /** Parsed artwork data */
  artworks: RemoteArtworkData[]
  /** Total items in collection */
  totalItems: number
  /** URL of next page (if any) */
  nextPage?: string
}
