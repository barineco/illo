/**
 * ActivityPub Type Definitions
 *
 * Based on ActivityPub specification and ActivityStreams vocabulary
 * https://www.w3.org/TR/activitypub/
 * https://www.w3.org/TR/activitystreams-vocabulary/
 */

// ============================================
// Core ActivityStreams Types
// ============================================

export type ActivityType =
  | 'Create'
  | 'Update'
  | 'Delete'
  | 'Follow'
  | 'Accept'
  | 'Reject'
  | 'Add'
  | 'Remove'
  | 'Like'
  | 'Announce'
  | 'Undo'

export type ActorType = 'Person' | 'Service' | 'Application' | 'Group' | 'Organization'

export type ObjectType = 'Note' | 'Image' | 'Article' | 'Video' | 'Document'

// ============================================
// Actor (Person)
// ============================================

export interface PublicKey {
  id: string
  owner: string
  publicKeyPem: string
}

export interface Image {
  type: 'Image'
  mediaType: string
  url: string
}

export interface PropertyValue {
  type: 'PropertyValue'
  name: string
  value: string
}

export interface Actor {
  '@context': string | string[]
  id: string
  type: ActorType
  preferredUsername: string
  name: string | null
  summary: string | null
  inbox: string
  outbox: string
  followers: string
  following: string
  liked?: string
  publicKey: PublicKey
  icon?: Image
  image?: Image
  url: string
  manuallyApprovesFollowers?: boolean
  discoverable?: boolean
  published?: string
  attachment?: PropertyValue[]
  endpoints?: {
    sharedInbox?: string
  }
}

// ============================================
// Activity
// ============================================

export interface Activity {
  '@context': string | string[]
  id: string
  type: ActivityType
  actor: string | Actor
  object: string | object
  published?: string
  to?: string | string[]
  cc?: string | string[]
  bto?: string | string[]
  bcc?: string | string[]
}

export interface CreateActivity extends Activity {
  type: 'Create'
  object: Note | Image | Article
}

export interface UpdateActivity extends Activity {
  type: 'Update'
  object: Note | Image | Article | Actor
}

export interface DeleteActivity extends Activity {
  type: 'Delete'
  object: string | { id: string; type: string }
}

export interface FollowActivity extends Activity {
  type: 'Follow'
  object: string
}

export interface AcceptActivity extends Activity {
  type: 'Accept'
  object: FollowActivity | string
}

export interface RejectActivity extends Activity {
  type: 'Reject'
  object: FollowActivity | string
}

export interface LikeActivity extends Activity {
  type: 'Like'
  object: string
}

export interface AnnounceActivity extends Activity {
  type: 'Announce'
  object: string | object
}

export interface UndoActivity extends Activity {
  type: 'Undo'
  object: Activity | string
}

// ============================================
// Objects
// ============================================

export interface Note {
  id: string
  type: 'Note'
  content: string
  published?: string
  attributedTo: string
  inReplyTo?: string
  to?: string | string[]
  cc?: string | string[]
  sensitive?: boolean
  summary?: string
  attachment?: Image[]
  tag?: ActivityPubTag[]
}

export interface Article {
  id: string
  type: 'Article'
  name: string
  content: string
  published?: string
  attributedTo: string
  to?: string | string[]
  cc?: string | string[]
  sensitive?: boolean
  summary?: string
  attachment?: Image[]
  tag?: ActivityPubTag[]
}

export interface ActivityPubTag {
  type: 'Hashtag' | 'Mention'
  name: string
  href?: string
}

// ============================================
// Collections
// ============================================

export interface OrderedCollection {
  '@context': string
  id: string
  type: 'OrderedCollection'
  totalItems: number
  first?: string
  last?: string
  orderedItems?: Activity[]
}

export interface OrderedCollectionPage {
  '@context': string
  id: string
  type: 'OrderedCollectionPage'
  totalItems: number
  orderedItems: Activity[]
  partOf: string
  next?: string
  prev?: string
}

export interface Collection {
  '@context': string
  id: string
  type: 'Collection'
  totalItems: number
  first?: string
  last?: string
  items?: any[]
}

export interface CollectionPage {
  '@context': string
  id: string
  type: 'CollectionPage'
  totalItems: number
  items: any[]
  partOf: string
  next?: string
  prev?: string
}

// ============================================
// WebFinger
// ============================================

export interface WebFingerLink {
  rel: string
  type?: string
  href?: string
  template?: string
}

export interface WebFingerResponse {
  subject: string
  aliases?: string[]
  links: WebFingerLink[]
}

// ============================================
// NodeInfo
// ============================================

export interface NodeInfo {
  version: '2.0' | '2.1'
  software: {
    name: string
    version: string
    repository?: string
    homepage?: string
  }
  protocols: string[]
  services: {
    inbound: string[]
    outbound: string[]
  }
  openRegistrations: boolean
  usage: {
    users: {
      total: number
      activeMonth?: number
      activeHalfyear?: number
    }
    localPosts?: number
    localComments?: number
  }
  metadata: {
    [key: string]: any
  }
}

export interface NodeInfoLinks {
  links: Array<{
    rel: string
    href: string
  }>
}

// ============================================
// HTTP Signatures
// ============================================

export interface HttpSignature {
  keyId: string
  algorithm: 'rsa-sha256' | 'hs2019'
  headers: string[]
  signature: string
}

export interface SignatureOptions {
  keyId: string
  privateKey: string
  headers: string[]
  method: string
  path: string
  body?: string
}

// ============================================
// Helper Types
// ============================================

export interface ActivityPubContext {
  '@context': string | string[]
}

export const AP_CONTEXT = 'https://www.w3.org/ns/activitystreams'
export const AP_SECURITY_CONTEXT = 'https://w3id.org/security/v1'
export const AP_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public'

// Default contexts for ActivityPub objects
export const DEFAULT_CONTEXT = [AP_CONTEXT, AP_SECURITY_CONTEXT]
