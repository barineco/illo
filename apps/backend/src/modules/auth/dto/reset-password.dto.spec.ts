import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { ResetPasswordDto } from './reset-password.dto'

function createDto(data: Partial<ResetPasswordDto>) {
  return plainToInstance(ResetPasswordDto, data)
}

describe('ResetPasswordDto', () => {
  const validToken = 'a'.repeat(32)

  it('passes with valid data', async () => {
    const dto = createDto({ token: validToken, newPassword: 'newPass123' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when token is too short', async () => {
    const dto = createDto({ token: 'short', newPassword: 'newPass123' })
    const errors = await validate(dto)
    const err = errors.find((e) => e.property === 'token')
    expect(err).toBeDefined()
  })

  it('fails when token is empty', async () => {
    const dto = createDto({ token: '', newPassword: 'newPass123' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('fails when newPassword is too short', async () => {
    const dto = createDto({ token: validToken, newPassword: 'short' })
    const errors = await validate(dto)
    const err = errors.find((e) => e.property === 'newPassword')
    expect(err).toBeDefined()
  })

  it('fails when newPassword exceeds 128 characters', async () => {
    const dto = createDto({
      token: validToken,
      newPassword: 'a'.repeat(129),
    })
    const errors = await validate(dto)
    const err = errors.find((e) => e.property === 'newPassword')
    expect(err).toBeDefined()
  })
})
