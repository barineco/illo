import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'

/**
 * Message encryption service using AES-256-GCM
 *
 * This service provides database-level encryption for direct messages.
 * When enabled, messages are encrypted before storage and decrypted when retrieved.
 *
 * Key features:
 * - AES-256-GCM encryption with per-message random IV
 * - Authentication tag included in encrypted data
 * - Optional - can be disabled in development
 * - Separate key from image encryption key
 *
 * Encryption format:
 * - encryptionVersion: 0 = plaintext, 1 = AES-256-GCM
 * - contentIv: Base64 encoded IV (16 bytes)
 * - content: Base64 encoded [encrypted data + auth tag]
 */
@Injectable()
export class MessageEncryptionService {
  private readonly logger = new Logger(MessageEncryptionService.name)
  private masterKey: Buffer | null = null

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('MESSAGE_ENCRYPTION_KEY')

    if (keyHex && keyHex.length === 64) {
      this.masterKey = Buffer.from(keyHex, 'hex')
      this.logger.log('Message encryption enabled')
    } else if (process.env.NODE_ENV === 'production') {
      this.logger.error('MESSAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) in production')
      throw new Error('MESSAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    } else {
      this.logger.warn('MESSAGE_ENCRYPTION_KEY not set - message encryption disabled (development mode)')
    }
  }

  /**
   * Check if encryption is enabled
   */
  isEnabled(): boolean {
    return this.masterKey !== null
  }

  /**
   * Encrypt a message content
   *
   * @param content - The plaintext message content
   * @returns Object containing encrypted content (base64), IV (base64), and encryption version
   */
  encrypt(content: string): { encryptedContent: string; iv: string; version: number } {
    if (!this.masterKey) {
      // Return plaintext if encryption is disabled
      return {
        encryptedContent: content,
        iv: '',
        version: 0,
      }
    }

    // Generate random 16-byte IV
    const iv = crypto.randomBytes(16)

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv)

    // Encrypt content (UTF-8 encoded)
    const encrypted = Buffer.concat([
      cipher.update(content, 'utf8'),
      cipher.final(),
    ])

    // Get authentication tag (16 bytes)
    const authTag = cipher.getAuthTag()

    // Combine encrypted data with auth tag
    const combined = Buffer.concat([encrypted, authTag])

    return {
      encryptedContent: combined.toString('base64'),
      iv: iv.toString('base64'),
      version: 1,
    }
  }

  /**
   * Decrypt a message content
   *
   * @param encryptedContent - The encrypted content (base64 if version > 0)
   * @param ivBase64 - The IV as base64 string
   * @param version - The encryption version (0 = plaintext)
   * @returns Decrypted message content
   */
  decrypt(encryptedContent: string, ivBase64: string | null, version: number): string {
    // Version 0 = plaintext
    if (version === 0 || !ivBase64) {
      return encryptedContent
    }

    if (!this.masterKey) {
      this.logger.error('Cannot decrypt message: MESSAGE_ENCRYPTION_KEY not set')
      return '[Message encrypted - decryption key not available]'
    }

    try {
      const iv = Buffer.from(ivBase64, 'base64')
      const combined = Buffer.from(encryptedContent, 'base64')

      // Extract auth tag (last 16 bytes)
      const authTag = combined.slice(-16)
      const encrypted = combined.slice(0, -16)

      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv)
      decipher.setAuthTag(authTag)

      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ])

      return decrypted.toString('utf8')
    } catch (error) {
      this.logger.error(`Failed to decrypt message: ${error.message}`)
      return '[Message decryption failed]'
    }
  }

  /**
   * Process a message for storage (encrypt if enabled)
   *
   * @param content - The plaintext message content
   * @returns Object with content, contentIv, and encryptionVersion for Prisma
   */
  prepareForStorage(content: string): {
    content: string
    contentIv: string | null
    encryptionVersion: number
  } {
    const { encryptedContent, iv, version } = this.encrypt(content)

    return {
      content: encryptedContent,
      contentIv: version > 0 ? iv : null,
      encryptionVersion: version,
    }
  }

  /**
   * Process a message for retrieval (decrypt if encrypted)
   *
   * @param message - Message object with content, contentIv, and encryptionVersion
   * @returns Decrypted message content
   */
  decryptMessage(message: {
    content: string
    contentIv?: string | null
    encryptionVersion?: number
  }): string {
    return this.decrypt(
      message.content,
      message.contentIv ?? null,
      message.encryptionVersion ?? 0,
    )
  }

  /**
   * Batch decrypt multiple messages
   *
   * @param messages - Array of message objects
   * @returns Messages with decrypted content
   */
  decryptMessages<T extends { content: string; contentIv?: string | null; encryptionVersion?: number }>(
    messages: T[],
  ): (T & { content: string })[] {
    return messages.map((message) => ({
      ...message,
      content: this.decryptMessage(message),
    }))
  }
}
