import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImageSigningService } from './image-signing.service'
import { ConfigService } from '@nestjs/config'

const VALID_KEY = 'a'.repeat(64)

function createService(
  config: Record<string, string> = {},
): ImageSigningService {
  const defaults: Record<string, string> = {
    IMAGE_SIGNING_KEY: VALID_KEY,
    IMAGE_SIGNED_URL_ENABLED: 'true',
    IMAGE_SIGNED_URL_EXPIRES: '90',
    BASE_URL: 'http://localhost:11104',
  }
  const merged = { ...defaults, ...config }
  const configService = {
    get: vi.fn((key: string, fallback?: string) => merged[key] ?? fallback),
  } as unknown as ConfigService
  return new ImageSigningService(configService)
}

describe('ImageSigningService', () => {
  describe('isEnabled', () => {
    it('returns true when key and flag are set', () => {
      const service = createService()
      expect(service.isEnabled()).toBe(true)
    })

    it('returns false when flag is not true', () => {
      const service = createService({ IMAGE_SIGNED_URL_ENABLED: 'false' })
      expect(service.isEnabled()).toBe(false)
    })

    it('returns false when key is missing', () => {
      const service = createService({ IMAGE_SIGNING_KEY: '' })
      expect(service.isEnabled()).toBe(false)
    })

    it('returns false when key length is invalid', () => {
      const service = createService({ IMAGE_SIGNING_KEY: 'tooshort' })
      expect(service.isEnabled()).toBe(false)
    })
  })

  describe('generateSignedUrlV2 / verifyTokenV2', () => {
    let service: ImageSigningService

    beforeEach(() => {
      service = createService()
    })

    it('generates a URL containing the imageId', () => {
      const result = service.generateSignedUrlV2('img-123', 'standard')
      expect(result.url).toContain('/api/images/img-123')
      expect(result.url).toContain('token=')
      expect(result.url).toContain('expires=')
    })

    it('adds thumb=true for thumbnail variant', () => {
      const result = service.generateSignedUrlV2('img-123', 'thumbnail')
      expect(result.url).toContain('thumb=true')
    })

    it('adds original=true for original variant', () => {
      const result = service.generateSignedUrlV2('img-123', 'original')
      expect(result.url).toContain('original=true')
    })

    it('does not add extra params for standard variant', () => {
      const result = service.generateSignedUrlV2('img-123', 'standard')
      expect(result.url).not.toContain('thumb=')
      expect(result.url).not.toContain('original=')
    })

    it('round-trips: generated token verifies correctly', () => {
      const result = service.generateSignedUrlV2('img-123', 'standard')
      const url = new URL(result.url)
      const token = url.searchParams.get('token')!
      const expires = url.searchParams.get('expires')!
      expect(service.verifyTokenV2('img-123', 'standard', token, expires)).toBe(
        true,
      )
    })

    it('rejects token for different imageId', () => {
      const result = service.generateSignedUrlV2('img-123', 'standard')
      const url = new URL(result.url)
      const token = url.searchParams.get('token')!
      const expires = url.searchParams.get('expires')!
      expect(
        service.verifyTokenV2('img-other', 'standard', token, expires),
      ).toBe(false)
    })

    it('rejects token for different variant', () => {
      const result = service.generateSignedUrlV2('img-123', 'standard')
      const url = new URL(result.url)
      const token = url.searchParams.get('token')!
      const expires = url.searchParams.get('expires')!
      expect(
        service.verifyTokenV2('img-123', 'thumbnail', token, expires),
      ).toBe(false)
    })

    it('rejects tampered token', () => {
      const result = service.generateSignedUrlV2('img-123', 'standard')
      const url = new URL(result.url)
      const expires = url.searchParams.get('expires')!
      expect(
        service.verifyTokenV2('img-123', 'standard', 'tampered', expires),
      ).toBe(false)
    })

    it('rejects expired token', () => {
      const pastExpires = String(Math.floor(Date.now() / 1000) - 100)
      expect(
        service.verifyTokenV2('img-123', 'standard', 'anytoken', pastExpires),
      ).toBe(false)
    })

    it('rejects non-numeric expires', () => {
      expect(
        service.verifyTokenV2('img-123', 'standard', 'anytoken', 'notanumber'),
      ).toBe(false)
    })

    it('strips trailing slash from base URL', () => {
      const svc = createService({ BASE_URL: 'http://example.com/' })
      const result = svc.generateSignedUrlV2('img-1', 'standard')
      expect(result.url.startsWith('http://example.com/api/')).toBe(true)
    })
  })

  describe('generateSignedUrl (v1)', () => {
    it('generates a valid URL', () => {
      const service = createService()
      const result = service.generateSignedUrl('img-1', false)
      expect(result.url).toContain('/api/images/img-1')
      expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })

    it('throws when signing key is not configured', () => {
      const service = createService({ IMAGE_SIGNING_KEY: '' })
      expect(() => service.generateSignedUrl('img-1')).toThrow(
        'Image signing key not configured',
      )
    })
  })

  describe('verifyToken (v1)', () => {
    it('returns false when signing key is missing', () => {
      const service = createService({ IMAGE_SIGNING_KEY: '' })
      expect(service.verifyToken('img-1', false, 'token', '99999999999')).toBe(
        false,
      )
    })
  })
})
