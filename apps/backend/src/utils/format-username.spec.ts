import { describe, it, expect } from 'vitest'
import { formatUsername, formatUserHandle } from './format-username'

describe('formatUsername', () => {
  it('returns @username for local users (domain is null)', () => {
    expect(formatUsername('alice', null)).toBe('@alice')
  })

  it('returns @username@domain for remote users', () => {
    expect(formatUsername('bob', 'example.com')).toBe('@bob@example.com')
  })

  it('treats undefined domain as local user', () => {
    expect(formatUsername('carol', undefined as any)).toBe('@carol')
  })
})

describe('formatUserHandle', () => {
  it('formats local user object', () => {
    expect(formatUserHandle({ username: 'alice' })).toBe('@alice')
  })

  it('formats local user with explicit null domain', () => {
    expect(formatUserHandle({ username: 'alice', domain: null })).toBe(
      '@alice',
    )
  })

  it('formats remote user object', () => {
    expect(
      formatUserHandle({ username: 'bob', domain: 'example.com' }),
    ).toBe('@bob@example.com')
  })

  it('formats user with undefined domain', () => {
    expect(
      formatUserHandle({ username: 'carol', domain: undefined }),
    ).toBe('@carol')
  })
})
