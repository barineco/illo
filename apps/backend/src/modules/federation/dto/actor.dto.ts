/**
 * Actor DTOs
 * Re-exports from shared package
 */

export { Actor, PublicKey, Image, ActorType } from '@illo/shared'

export interface KeyPair {
  publicKey: string
  privateKey: string
}
