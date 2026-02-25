import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { CreateWordMuteDto } from './create-word-mute.dto'

function createDto(data: Partial<CreateWordMuteDto>) {
  return plainToInstance(CreateWordMuteDto, data)
}

describe('CreateWordMuteDto', () => {
  it('passes with just keyword', async () => {
    const dto = createDto({ keyword: 'spam' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when keyword exceeds 255 characters', async () => {
    const dto = createDto({ keyword: 'a'.repeat(256) })
    const errors = await validate(dto)
    const err = errors.find((e) => e.property === 'keyword')
    expect(err).toBeDefined()
  })

  it('accepts 255-character keyword', async () => {
    const dto = createDto({ keyword: 'a'.repeat(255) })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('accepts optional boolean flags', async () => {
    const dto = createDto({
      keyword: 'test',
      regex: true,
      wholeWord: true,
      caseSensitive: false,
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when boolean flag is not boolean', async () => {
    const dto = createDto({ keyword: 'test', regex: 'yes' as any })
    const errors = await validate(dto)
    const err = errors.find((e) => e.property === 'regex')
    expect(err).toBeDefined()
  })

  it('accepts valid duration', async () => {
    const dto = createDto({ keyword: 'test', duration: 3600 })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when duration is below minimum (60)', async () => {
    const dto = createDto({ keyword: 'test', duration: 30 })
    const errors = await validate(dto)
    const err = errors.find((e) => e.property === 'duration')
    expect(err).toBeDefined()
  })

  it('accepts duration of exactly 60', async () => {
    const dto = createDto({ keyword: 'test', duration: 60 })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('allows duration to be omitted (permanent mute)', async () => {
    const dto = createDto({ keyword: 'test' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })
})
