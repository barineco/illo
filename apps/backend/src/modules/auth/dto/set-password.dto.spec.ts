import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { SetPasswordDto } from './set-password.dto'

describe('SetPasswordDto', () => {
  it('passes with valid password', async () => {
    const dto = plainToInstance(SetPasswordDto, { newPassword: 'newPass123' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when newPassword is empty', async () => {
    const dto = plainToInstance(SetPasswordDto, { newPassword: '' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('fails when newPassword is too short', async () => {
    const dto = plainToInstance(SetPasswordDto, { newPassword: 'short' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    const messages = errors.flatMap((e) => Object.values(e.constraints || {}))
    expect(messages.some((m) => m.includes('at least 8 characters'))).toBe(true)
  })

  it('fails when newPassword exceeds 128 characters', async () => {
    const dto = plainToInstance(SetPasswordDto, {
      newPassword: 'a'.repeat(129),
    })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('accepts 128-character password', async () => {
    const dto = plainToInstance(SetPasswordDto, {
      newPassword: 'a'.repeat(128),
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })
})
