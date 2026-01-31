/**
 * WebFinger Protocol DTOs
 * https://tools.ietf.org/html/rfc7033
 *
 * Re-exports from shared package
 */

export { WebFingerLink, WebFingerResponse } from '@illo/shared'

export interface WebFingerQuery {
  resource: string // acct:username@domain or https://domain/users/username
  rel?: string
}

export interface ParsedHandle {
  username: string
  domain: string | null // null = local user
}
