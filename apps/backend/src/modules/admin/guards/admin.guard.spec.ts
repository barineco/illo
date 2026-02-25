import { describe, it, expect, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { AdminGuard } from './admin.guard'

function mockContext(user: any) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any
}

describe('AdminGuard', () => {
  const guard = new AdminGuard()

  it('allows ADMIN users', () => {
    expect(guard.canActivate(mockContext({ role: 'ADMIN' }))).toBe(true)
  })

  it('throws for non-ADMIN users', () => {
    expect(() => guard.canActivate(mockContext({ role: 'USER' }))).toThrow(
      ForbiddenException,
    )
  })

  it('throws when no user', () => {
    expect(() => guard.canActivate(mockContext(null))).toThrow(
      ForbiddenException,
    )
  })

  it('throws when user is undefined', () => {
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      ForbiddenException,
    )
  })
})
