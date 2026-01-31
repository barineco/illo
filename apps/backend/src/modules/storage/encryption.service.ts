import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'

/**
 * Image encryption service using AES-256-GCM
 *
 * This service provides optional encryption for artwork images to protect
 * against direct URL access and crawlers. When enabled, images are encrypted
 * before storage and decrypted when served through the proxy API.
 *
 * Key features:
 * - AES-256-GCM encryption with per-image random IV
 * - Authentication tag included in encrypted data
 * - Optional - can be disabled in development
 * - Separate key from 2FA encryption key
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name)
  private masterKey: Buffer | null = null

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('IMAGE_ENCRYPTION_KEY')

    if (keyHex && keyHex.length === 64) {
      this.masterKey = Buffer.from(keyHex, 'hex')
      this.logger.log('Image encryption enabled')
    } else if (process.env.NODE_ENV === 'production') {
      this.logger.error('IMAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes) in production')
      throw new Error('IMAGE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    } else {
      this.logger.warn('IMAGE_ENCRYPTION_KEY not set - image encryption disabled (development mode)')
    }
  }

  /**
   * Check if encryption is enabled
   */
  isEnabled(): boolean {
    return this.masterKey !== null
  }

  /**
   * Encrypt data using AES-256-GCM
   *
   * @param data - The data to encrypt
   * @returns Object containing encrypted data and IV (base64 encoded)
   */
  async encrypt(data: Buffer): Promise<{ encrypted: Buffer; iv: string }> {
    if (!this.masterKey) {
      throw new Error('Encryption is not enabled')
    }

    // Generate random 16-byte IV
    const iv = crypto.randomBytes(16)

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv)

    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ])

    // Get authentication tag (16 bytes)
    const authTag = cipher.getAuthTag()

    // Combine encrypted data with auth tag
    const combined = Buffer.concat([encrypted, authTag])

    return {
      encrypted: combined,
      iv: iv.toString('base64'),
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   *
   * @param encrypted - The encrypted data (includes auth tag at the end)
   * @param ivBase64 - The IV as base64 string
   * @returns Decrypted data
   */
  async decrypt(encrypted: Buffer, ivBase64: string): Promise<Buffer> {
    if (!this.masterKey) {
      throw new Error('Encryption is not enabled')
    }

    const iv = Buffer.from(ivBase64, 'base64')

    // Extract auth tag (last 16 bytes)
    const authTag = encrypted.slice(-16)
    const data = encrypted.slice(0, -16)

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv)
    decipher.setAuthTag(authTag)

    // Decrypt data
    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ])
  }
}
