import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { RequestEmailChangeDto } from './request-email-change.dto'

describe('RequestEmailChangeDto', () => {
  it('passes with valid email and no password', async () => {
    const dto = plainToInstance(RequestEmailChangeDto, {
      email: 'test@example.com',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('passes with valid email and password', async () => {
    const dto = plainToInstance(RequestEmailChangeDto, {
      email: 'test@example.com',
      password: 'myPassword123',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails with invalid email', async () => {
    const dto = plainToInstance(RequestEmailChangeDto, {
      email: 'not-an-email',
    })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('fails with empty email', async () => {
    const dto = plainToInstance(RequestEmailChangeDto, { email: '' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
  })
})
