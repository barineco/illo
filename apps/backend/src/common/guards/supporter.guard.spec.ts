import { describe, it, expect, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SupporterGuard } from './supporter.guard'

function mockContext(user: any) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any
}

describe('SupporterGuard', () => {
  const reflector = new Reflector()

  it('throws ForbiddenException when no user', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
    const guard = new SupporterGuard(reflector)
    expect(() => guard.canActivate(mockContext(null))).toThrow(
      ForbiddenException,
    )
  })

  it('throws when user has NONE tier and any supporter is required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
    const guard = new SupporterGuard(reflector)
    expect(() =>
      guard.canActivate(mockContext({ supporterTier: 'NONE' })),
    ).toThrow(ForbiddenException)
  })

  it('allows TIER_1 user when no specific tier required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
    const guard = new SupporterGuard(reflector)
    expect(guard.canActivate(mockContext({ supporterTier: 'TIER_1' }))).toBe(
      true,
    )
  })

  it('throws when TIER_1 user accesses TIER_2 feature', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('TIER_2')
    const guard = new SupporterGuard(reflector)
    expect(() =>
      guard.canActivate(mockContext({ supporterTier: 'TIER_1' })),
    ).toThrow(ForbiddenException)
  })

  it('allows TIER_3 user to access TIER_2 feature', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('TIER_2')
    const guard = new SupporterGuard(reflector)
    expect(guard.canActivate(mockContext({ supporterTier: 'TIER_3' }))).toBe(
      true,
    )
  })

  it('allows same tier as required', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue('TIER_2')
    const guard = new SupporterGuard(reflector)
    expect(guard.canActivate(mockContext({ supporterTier: 'TIER_2' }))).toBe(
      true,
    )
  })

  it('defaults to NONE when user has no supporterTier field', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
    const guard = new SupporterGuard(reflector)
    expect(() => guard.canActivate(mockContext({}))).toThrow(ForbiddenException)
  })
})
