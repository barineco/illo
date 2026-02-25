import { describe, it, expect } from 'vitest'
import { useUsername } from './useUsername'

describe('useUsername', () => {
  const { formatUsername, formatUserHandle, getUserPath, getUserPathFromUser } =
    useUsername()

  describe('formatUsername', () => {
    it('formats local user', () => {
      expect(formatUsername('alice')).toBe('@alice')
    })

    it('formats local user with null domain', () => {
      expect(formatUsername('alice', null)).toBe('@alice')
    })

    it('formats local user with undefined domain', () => {
      expect(formatUsername('alice', undefined)).toBe('@alice')
    })

    it('formats remote user with domain', () => {
      expect(formatUsername('alice', 'example.com')).toBe('@alice@example.com')
    })
  })

  describe('formatUserHandle', () => {
    it('formats local user object', () => {
      expect(formatUserHandle({ username: 'bob' })).toBe('@bob')
    })

    it('formats remote user object', () => {
      expect(
        formatUserHandle({ username: 'bob', domain: 'remote.dev' }),
      ).toBe('@bob@remote.dev')
    })
  })

  describe('getUserPath', () => {
    it('returns local user path', () => {
      expect(getUserPath('alice')).toBe('/users/alice')
    })

    it('returns remote user path', () => {
      expect(getUserPath('alice', 'example.com')).toBe(
        '/users/alice@example.com',
      )
    })

    it('treats empty string domain as local', () => {
      expect(getUserPath('alice', '')).toBe('/users/alice')
    })
  })

  describe('getUserPathFromUser', () => {
    it('returns path from user object', () => {
      expect(
        getUserPathFromUser({ username: 'bob', domain: 'remote.dev' }),
      ).toBe('/users/bob@remote.dev')
    })
  })
})
