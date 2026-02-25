import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HeadlessDetectionService } from './headless-detection.service'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

function createService(
  configOverrides: Record<string, any> = {},
): HeadlessDetectionService {
  const defaults: Record<string, any> = {
    HEADLESS_DETECTION_ENABLED: true,
    HEADLESS_DETECTION_MEASUREMENT_MODE: true,
    HEADLESS_DETECTION_SUSPICIOUS_THRESHOLD: 31,
    HEADLESS_DETECTION_LIKELY_BOT_THRESHOLD: 51,
    HEADLESS_DETECTION_DEFINITE_BOT_THRESHOLD: 76,
    HEADLESS_DETECTION_INTERACTION_SECRET: 'test-secret',
  }
  const merged = { ...defaults, ...configOverrides }
  const configService = {
    get: vi.fn((key: string, fallback?: any) => merged[key] ?? fallback),
  } as unknown as ConfigService

  const prisma = {
    headlessDetectionLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as any

  return new HeadlessDetectionService(configService, prisma)
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      connection: 'keep-alive',
      'sec-ch-ua':
        '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      ...overrides.headers,
    },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request
}

describe('HeadlessDetectionService', () => {
  let service: HeadlessDetectionService

  beforeEach(() => {
    service = createService()
  })

  describe('isEnabled / getConfig', () => {
    it('returns enabled status from config', () => {
      expect(service.isEnabled()).toBe(true)
    })

    it('returns config copy', () => {
      const config = service.getConfig()
      expect(config.suspiciousThreshold).toBe(31)
      expect(config.likelyBotThreshold).toBe(51)
    })
  })

  describe('analyze - normal browser', () => {
    it('gives low score for a fully equipped normal browser request', async () => {
      const crypto = await import('crypto')
      const timestamp = String(Math.floor(Date.now() / 1000))
      const signature = crypto
        .createHmac('sha256', 'test-secret')
        .update(timestamp)
        .digest('hex')
      const fp = Buffer.from(
        JSON.stringify({
          webdriver: false,
          pluginsCount: 5,
          maxTouchPoints: 0,
          webglRenderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)',
          canvas: 'abc123hash',
        }),
      ).toString('base64')
      const req = mockRequest()
      req.headers['x-user-interaction-token'] = `${timestamp}:${signature}`
      req.headers['x-real-user-interaction'] = 'true'
      req.headers['x-device-fingerprint'] = fp
      const result = await service.analyze(req)
      expect(result.totalScore).toBeLessThan(31)
      expect(result.verdict).toBe('normal')
    })
  })

  describe('analyze - User-Agent signals', () => {
    it('detects empty User-Agent', async () => {
      const req = mockRequest({ headers: { 'user-agent': '' } })
      const result = await service.analyze(req)
      expect(result.signals.userAgent.isEmpty).toBe(true)
      expect(result.signals.userAgent.score).toBeGreaterThan(0)
    })

    it('detects HeadlessChrome', async () => {
      const req = mockRequest({
        headers: { 'user-agent': 'Mozilla/5.0 HeadlessChrome/120.0' },
      })
      const result = await service.analyze(req)
      expect(result.signals.userAgent.isHeadless).toBe(true)
      expect(result.signals.userAgent.score).toBeGreaterThan(0)
    })

    it('detects Puppeteer', async () => {
      const req = mockRequest({
        headers: { 'user-agent': 'Puppeteer/1.0' },
      })
      const result = await service.analyze(req)
      expect(result.signals.userAgent.isHeadless).toBe(true)
    })

    it('detects bot patterns', async () => {
      const req = mockRequest({
        headers: { 'user-agent': 'Googlebot/2.1' },
      })
      const result = await service.analyze(req)
      expect(result.signals.userAgent.knownBotPattern).toBe(true)
    })

    it('detects short User-Agent', async () => {
      const req = mockRequest({
        headers: { 'user-agent': 'curl/7.0' },
      })
      const result = await service.analyze(req)
      expect(result.signals.userAgent.score).toBeGreaterThan(0)
    })
  })

  describe('analyze - Client Hints signals', () => {
    it('flags Chrome UA without Client Hints', async () => {
      const req = mockRequest({
        headers: {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36',
          'sec-ch-ua': undefined as any,
          'sec-ch-ua-mobile': undefined as any,
          'sec-ch-ua-platform': undefined as any,
        },
      })
      const result = await service.analyze(req)
      expect(result.signals.clientHints.score).toBeGreaterThan(0)
    })
  })

  describe('analyze - Header Consistency signals', () => {
    it('flags missing Accept-Language', async () => {
      const req = mockRequest({
        headers: { 'accept-language': undefined as any },
      })
      const result = await service.analyze(req)
      expect(result.signals.headerConsistency.hasAcceptLanguage).toBe(false)
      expect(result.signals.headerConsistency.score).toBeGreaterThan(0)
    })

    it('flags missing Accept-Encoding', async () => {
      const req = mockRequest({
        headers: { 'accept-encoding': undefined as any },
      })
      const result = await service.analyze(req)
      expect(result.signals.headerConsistency.hasAcceptEncoding).toBe(false)
    })
  })

  describe('analyze - Device Fingerprint signals', () => {
    it('flags missing fingerprint', async () => {
      const result = await service.analyze(mockRequest())
      expect(result.signals.deviceFingerprint.hasFingerprint).toBe(false)
      expect(result.signals.deviceFingerprint.score).toBeGreaterThan(0)
    })

    it('detects webdriver flag', async () => {
      const fp = Buffer.from(
        JSON.stringify({
          webdriver: true,
          pluginsCount: 5,
          maxTouchPoints: 0,
          webglRenderer: 'ANGLE',
          canvas: 'abc123',
        }),
      ).toString('base64')
      const req = mockRequest({
        headers: { 'x-device-fingerprint': fp },
      })
      const result = await service.analyze(req)
      expect(result.signals.deviceFingerprint.webdriverDetected).toBe(true)
    })

    it('detects suspicious WebGL renderer', async () => {
      const fp = Buffer.from(
        JSON.stringify({
          webdriver: false,
          pluginsCount: 5,
          maxTouchPoints: 0,
          webglRenderer: 'Google SwiftShader',
          canvas: 'abc123',
        }),
      ).toString('base64')
      const req = mockRequest({
        headers: { 'x-device-fingerprint': fp },
      })
      const result = await service.analyze(req)
      expect(result.signals.deviceFingerprint.suspiciousWebGL).toBe(true)
    })
  })

  describe('verdict thresholds', () => {
    it('classifies high-score requests as definite_bot', async () => {
      const req = mockRequest({
        headers: {
          'user-agent': '',
          'accept-language': undefined as any,
          'accept-encoding': undefined as any,
          'sec-ch-ua': undefined as any,
          'sec-ch-ua-mobile': undefined as any,
          'sec-ch-ua-platform': undefined as any,
        },
      })
      const result = await service.analyze(req)
      expect(result.totalScore).toBeGreaterThanOrEqual(76)
      expect(result.verdict).toBe('definite_bot')
    })
  })
})
