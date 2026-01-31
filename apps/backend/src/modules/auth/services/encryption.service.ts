import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm'
  private readonly ivLength = 16 // 128 bits
  private readonly authTagLength = 16 // 128 bits
  private readonly encryptionKey: Buffer

  constructor() {
    const keyHex = process.env.ENCRYPTION_KEY
    if (!keyHex || keyHex.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be set in environment variables (64 hex characters = 32 bytes)',
      )
    }
    this.encryptionKey = Buffer.from(keyHex, 'hex')
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * @returns Format: "iv:authTag:ciphertext" (all base64-encoded)
   */
  encrypt(plaintext: string): string {
    // Generate random IV for each encryption (security best practice)
    const iv = crypto.randomBytes(this.ivLength)

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv)

    // Encrypt
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
    ciphertext += cipher.final('base64')

    // Get authentication tag
    const authTag = cipher.getAuthTag()

    // Combine: iv:authTag:ciphertext
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   * @param encrypted Format: "iv:authTag:ciphertext" (all base64-encoded)
   */
  decrypt(encrypted: string): string {
    try {
      // Parse encrypted data
      const parts = encrypted.split(':')
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format')
      }

      const iv = Buffer.from(parts[0], 'base64')
      const authTag = Buffer.from(parts[1], 'base64')
      const ciphertext = parts[2]

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      )
      decipher.setAuthTag(authTag)

      // Decrypt
      let plaintext = decipher.update(ciphertext, 'base64', 'utf8')
      plaintext += decipher.final('utf8')

      return plaintext
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`)
    }
  }
}
