import { Test, TestingModule } from '@nestjs/testing'
import { EncryptionService } from './encryption.service'

describe('EncryptionService', () => {
  let service: EncryptionService

  beforeAll(() => {
    // Set test encryption key
    process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes in hex
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile()

    service = module.get<EncryptionService>(EncryptionService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP' // Sample TOTP secret
    const encrypted = service.encrypt(plaintext)
    const decrypted = service.decrypt(encrypted)

    expect(decrypted).toBe(plaintext)
  })

  it('should produce different ciphertext for same plaintext (different IV)', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP'
    const encrypted1 = service.encrypt(plaintext)
    const encrypted2 = service.encrypt(plaintext)

    expect(encrypted1).not.toBe(encrypted2) // Different IV each time
  })

  it('should have correct encrypted format (iv:authTag:ciphertext)', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP'
    const encrypted = service.encrypt(plaintext)

    const parts = encrypted.split(':')
    expect(parts).toHaveLength(3)
  })

  it('should throw error for tampered ciphertext', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP'
    const encrypted = service.encrypt(plaintext)

    // Tamper with ciphertext (change last character)
    const tampered = encrypted.slice(0, -1) + 'X'

    expect(() => service.decrypt(tampered)).toThrow()
  })

  it('should throw error for invalid format', () => {
    expect(() => service.decrypt('invalid')).toThrow(
      'Invalid encrypted data format',
    )
  })

  it('should throw error for missing ENCRYPTION_KEY', () => {
    const originalKey = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY

    expect(() => new EncryptionService()).toThrow(
      'ENCRYPTION_KEY must be set in environment variables',
    )

    // Restore
    process.env.ENCRYPTION_KEY = originalKey
  })

  it('should throw error for invalid ENCRYPTION_KEY length', () => {
    const originalKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = 'tooshort'

    expect(() => new EncryptionService()).toThrow(
      'ENCRYPTION_KEY must be set in environment variables',
    )

    // Restore
    process.env.ENCRYPTION_KEY = originalKey
  })
})
