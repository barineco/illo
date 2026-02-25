import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { ChangePasswordDto } from './change-password.dto'

function createDto(data: Partial<ChangePasswordDto>) {
  return plainToInstance(ChangePasswordDto, data)
}

describe('ChangePasswordDto', () => {
  it('passes with valid data', async () => {
    const dto = createDto({
      currentPassword: 'oldPass123',
      newPassword: 'newPass123',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when currentPassword is empty', async () => {
    const dto = createDto({ currentPassword: '', newPassword: 'newPass123' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('fails when newPassword is too short', async () => {
    const dto = createDto({ currentPassword: 'old', newPassword: 'short' })
    const errors = await validate(dto)
    const pwError = errors.find((e) => e.property === 'newPassword')
    expect(pwError).toBeDefined()
  })

  it('fails when newPassword exceeds 128 characters', async () => {
    const dto = createDto({
      currentPassword: 'old',
      newPassword: 'a'.repeat(129),
    })
    const errors = await validate(dto)
    const pwError = errors.find((e) => e.property === 'newPassword')
    expect(pwError).toBeDefined()
  })

  it('accepts 128-character password', async () => {
    const dto = createDto({
      currentPassword: 'old',
      newPassword: 'a'.repeat(128),
    })
    const errors = await validate(dto)
    const pwError = errors.find((e) => e.property === 'newPassword')
    expect(pwError).toBeUndefined()
  })

  it('accepts optional revokeOtherSessions boolean', async () => {
    const dto = createDto({
      currentPassword: 'old',
      newPassword: 'newPass123',
      revokeOtherSessions: true,
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when revokeOtherSessions is not boolean', async () => {
    const dto = createDto({
      currentPassword: 'old',
      newPassword: 'newPass123',
      revokeOtherSessions: 'yes' as any,
    })
    const errors = await validate(dto)
    const err = errors.find((e) => e.property === 'revokeOtherSessions')
    expect(err).toBeDefined()
  })
})
