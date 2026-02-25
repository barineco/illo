import { describe, it, expect } from 'vitest'
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard'

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard()

  it('returns user when authenticated', () => {
    const user = { id: '1', username: 'test' }
    expect(guard.handleRequest(null, user)).toBe(user)
  })

  it('returns null when user is false', () => {
    expect(guard.handleRequest(null, false)).toBeNull()
  })

  it('returns null when user is undefined', () => {
    expect(guard.handleRequest(null, undefined)).toBeNull()
  })

  it('returns null when user is null', () => {
    expect(guard.handleRequest(null, null)).toBeNull()
  })

  it('does not throw on error when no user', () => {
    expect(() =>
      guard.handleRequest(new Error('Token expired'), null),
    ).not.toThrow()
    expect(guard.handleRequest(new Error('Token expired'), null)).toBeNull()
  })
})
