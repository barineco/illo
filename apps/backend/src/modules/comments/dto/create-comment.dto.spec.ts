import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { CreateCommentDto } from './create-comment.dto'

function createDto(data: Partial<CreateCommentDto>) {
  return plainToInstance(CreateCommentDto, data)
}

describe('CreateCommentDto', () => {
  it('passes with valid content', async () => {
    const dto = createDto({ content: 'Nice artwork!' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('passes with content and parentId', async () => {
    const dto = createDto({ content: 'Reply!', parentId: 'comment-123' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('fails when content is empty', async () => {
    const dto = createDto({ content: '' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('fails when content exceeds 1000 characters', async () => {
    const dto = createDto({ content: 'a'.repeat(1001) })
    const errors = await validate(dto)
    const err = errors.find((e) => e.property === 'content')
    expect(err).toBeDefined()
  })

  it('accepts 1000-character content', async () => {
    const dto = createDto({ content: 'a'.repeat(1000) })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })

  it('allows parentId to be omitted', async () => {
    const dto = createDto({ content: 'Hello' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
  })
})
